﻿"use strict";

import BigInteger = require("BigInteger");
import ModNumber = require("ModNumber");
import ModPoint = require("ModPoint");
import ModPointAddPartialResult = require("ModPointAddPartialResult");
import ModPointSet = require("ModPointSet");
import IConfig = require("IConfig");
import IResultSink = require("IResultSink");
import Addition = require("AdditionTable");

module PollardRho {
    // based on the description in http://lacal.epfl.ch/files/content/sites/lacal/files/papers/noan112.pdf
    // as well as http://www.hyperelliptic.org/tanja/SHARCS/slides09/03-bos.pdf
    export function run(config: IConfig, resultSink: IResultSink): void {
        var table = new Addition.Table(config);

        var walk = new MultiCurveWalk(config, table);

        while (true) {
            for (var n = 0; n < config.checkCyclePeriod; n++) {
                walk.step();
                walk.send(resultSink);
            }

            var encountered = new ModPointSet();
            for (var n = 0; n < config.checkCycleLength; n++) {
                walk.step();
                walk.send(resultSink);

                if (!walk.addTo(encountered)) {
                    walk.escape();
                    break;
                }
            }
        }
    }

    // For tests, a version of run that finishes after a little while, and continuously checks for cycles
    export function runLimited(config: IConfig, resultSink: IResultSink): void {
        var table = new Addition.Table(config);

        var walk = new MultiCurveWalk(config, table);

        for (var x = 0; x < 10; x++) {
            for (var n = 0; n < config.checkCyclePeriod; n++) {
                walk.step();
                walk.send(resultSink);
            }

            var encountered = new ModPointSet();
            for (var n = 0; n < config.checkCycleLength; n++) {
                walk.step();
                walk.send(resultSink);

                if (!walk.addTo(encountered)) {
                    walk.escape();
                    break;
                }
            }
        }
    }

    class CurveWalk {
        private static INDEX = 0;

        private _config: IConfig;
        private _table: Addition.Table;

        private _index: number;
        private _u: ModNumber;
        private _v: ModNumber;
        private _current: ModPoint;
        private _currentIndex: number;
        private _reductionAdd: number;

        private _stats: Statistics;


        constructor(config: IConfig, table: Addition.Table) {
            this._config = config;
            this._table = table;

            this._index = CurveWalk.INDEX;
            var entry = this._table.at(this._index % this._table.length);
            this._u = entry.u;
            this._v = entry.v;
            this._current = entry.p;
            this._reductionAdd = 0;

            this._stats = config.computeStats ? new Statistics() : null;

            CurveWalk.INDEX++;
        }


        get u(): ModNumber {
            return this._u;
        }

        get v(): ModNumber {
            return this._v;
        }

        get current(): ModPoint {
            return this._current;
        }

        addTo(pointSet: ModPointSet) {
            return pointSet.add(this._current);
        }

        escape() {
            this.setCurrent(this._current.add(this._current), this._u, this._v);
        }

        send(sink: IResultSink): void {
            if (this._reductionAdd != 0) {
                // we're in the middle of a cycle reduction, the current point isn't valid
                if (this._stats != null) {
                    this._stats.incrementFruitless();
                }
                return;
            }

            if (this._current != ModPoint.INFINITY && (this._current.x.value.and(this._config.distinguishedPointMask)).compare(this._config.distinguishedPointMask) == 0) {
                sink.send(this._u, this._v, this._current);

                if (this._stats != null) {
                    console.log("Walk " + this._index + ": " + this._stats.toString());
                }
            }
        }

        /** If the result can already be computed, returns null; endStep must then not be called. */
        beginStep(): ModPointAddPartialResult {
            var index = this._current.partition(this._table.length);
            var entry = this._table.at(index);

            var partialResult = this._current.beginAdd(entry.p);
            if (partialResult.result == undefined) {
                return partialResult;
            }
            this.setCurrent(partialResult.result, entry.u, entry.v);
            return null;
        }

        endStep(lambda: ModNumber): void {
            var index = (this._current.partition(this._table.length) + this._reductionAdd) % this._table.length;
            var entry = this._table.at(index);
            this.setCurrent(this._current.endAdd(entry.p, lambda), entry.u, entry.v);

            if (this._stats != null) {
                this._stats.addPoint(this._current);
            }

            var newIndex = this._current.partition(this._table.length);
            if (newIndex == index) {
                this._reductionAdd++;

                // this is extremely unlikely, but it can happen
                if (this._reductionAdd == this._table.length) {
                    this.escape();
                    this._reductionAdd = 0;
                }
            } else {
                this._reductionAdd = 0;
            }
        }

        private setCurrent(candidate: ModPoint, u: ModNumber, v: ModNumber): void {
            var reflected = candidate.negate();

            this._u = this._u.add(u);
            this._v = this._v.add(v);

            if (candidate.compareY(reflected) == -1) {
                // take the smallest y
                candidate = reflected;
                this._u = this._u.negate();
                this._v = this._v.negate();
            }

            this._current = candidate;
        }
    }

    export class MultiCurveWalk {
        private _walks: CurveWalk[];

        constructor(config: IConfig, table: Addition.Table) {
            this._walks = Array<CurveWalk>(config.parrallelWalksCount);
            for (var n = 0; n < this._walks.length; n++) {
                this._walks[n] = new CurveWalk(config, table);
            }
        }

        step(): void {
            var x = Array<ModPointAddPartialResult>();
            var unfinishedWalks = new Array<CurveWalk>();

            for (var n = 0; n < this._walks.length; n++) {
                var result = this._walks[n].beginStep();
                if (result != null) {
                    x.push(result);
                    unfinishedWalks.push(this._walks[n]);
                }
            }

            if (unfinishedWalks.length != 0) {
                var a = Array<ModNumber>();
                a[0] = x[0].denominator;
                for (var n = 1; n < unfinishedWalks.length; n++) {
                    a[n] = a[n - 1].mul(x[n].denominator);
                }

                var xinv = Array<ModNumber>(a.length);
                var ainv = Array<ModNumber>(a.length);
                ainv[a.length - 1] = a[a.length - 1].invert();
                for (var n = unfinishedWalks.length - 1; n > 0; n--) {
                    xinv[n] = ainv[n].mul(a[n - 1]);
                    ainv[n - 1] = ainv[n].mul(x[n].denominator);
                }
                xinv[0] = ainv[0];

                for (var n = 0; n < unfinishedWalks.length; n++) {
                    var lambda = x[n].numerator.mul(xinv[n]);
                    unfinishedWalks[n].endStep(lambda);
                }
            }
        }

        addTo(pointSet: ModPointSet) {
            for (var n = 0; n < this._walks.length; n++) {
                if (!this._walks[n].addTo(pointSet)) {
                    return false;
                }
            }
            return true;
        }

        escape() {
            this._walks.forEach(w => w.escape());
        }

        send(sink: IResultSink): void {
            this._walks.forEach(w => w.send(sink));
        }
    }
}

class Statistics {
    private _points: ModPointSet;
    private _duplicatesCount: number;
    private _fruitlessCount: number;

    constructor() {
        this._points = new ModPointSet();
        this._duplicatesCount = 0;
        this._fruitlessCount = 0;
    }

    incrementFruitless(): void {
        this._fruitlessCount++;
    }

    addPoint(point: ModPoint): void {
        if (!this._points.add(point)) {
            this._duplicatesCount++;
        }
    }

    toString(): string {
        return this._points.size + " unique points, " + this._duplicatesCount + " duplicates, " + this._fruitlessCount + " points in fruitless cycles";
    }
}

export = PollardRho;