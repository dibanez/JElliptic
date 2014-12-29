﻿import BigInteger = require("BigInteger");
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

        var walk: CurveWalk =
            config.parrallelWalksCount == 1 ?
            new SingleCurveWalk(config, table) : new MultiCurveWalk(config, table);

        var checkCycleIndex = 0;

        while (true) {
            while (checkCycleIndex != config.checkCyclePeriod) {
                walk.step();
                walk.send(resultSink);
                checkCycleIndex++;
            }

            checkCycleIndex = 0;

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

    // For tests, a version of run that finishes after a little while
    export function runLimited(config: IConfig, resultSink: IResultSink): void {
        var table = new Addition.Table(config);

        var walk: CurveWalk =
            config.parrallelWalksCount == 1 ?
            new SingleCurveWalk(config, table) : new MultiCurveWalk(config, table);

        for (var n = 0; n < 100; n++) {
            walk.step();
            walk.send(resultSink);
        }
    }

    export interface CurveWalk {
        step(): void;
        addTo(pointSet: ModPointSet): boolean;
        escape(): void;
        send(sink: IResultSink): void;
    }

    export class SingleCurveWalk implements CurveWalk {
        private static INDEX = 0;

        private _config: IConfig;
        private _table: Addition.Table;

        private _index: number;
        private _u: ModNumber;
        private _v: ModNumber;
        private _current: ModPoint;

        private _currentEntry: Addition.TableEntry;

        private _allPoints: ModPointSet;


        constructor(config: IConfig, table: Addition.Table) {
            this._config = config;
            this._table = table;

            this._index = SingleCurveWalk.INDEX;
            var entry = this._table.at(this._index % this._table.length);
            this._u = entry.u;
            this._v = entry.v;
            this._current = entry.p;

            if (config.computePointsUniqueFraction) {
                this._allPoints = new ModPointSet();
            }

            SingleCurveWalk.INDEX++;
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

        step() {
            var index = this._current.partition(this._table.length);
            this._currentEntry = this._table.at(index);
            this._u = this._u.add(this._currentEntry.u);
            this._v = this._v.add(this._currentEntry.v);
            this.setCurrent(this._current.add(this._currentEntry.p));
        }

        addTo(pointSet: ModPointSet) {
            return pointSet.add(this._current);
        }

        escape() {
            this.setCurrent(this._current.add(this._current));
        }

        send(sink: IResultSink): void {
            if (this._current != ModPoint.INFINITY && (this._current.x.value.and(this._config.distinguishedPointMask)).compare(this._config.distinguishedPointMask) == 0) {
                sink.send(this._u, this._v, this._current);

                if (this._config.computePointsUniqueFraction) {
                    console.log("% of unique points for walk " + this._index + ": " + (this._allPoints.uniqueFraction * 100.0));
                }
            }
        }

        /** If the result can already be computed, returns null; endStep must then not be called. */
        beginStep(): ModPointAddPartialResult {
            var index = this._current.partition(this._table.length);
            this._currentEntry = this._table.at(index);
            this._u = this._u.add(this._currentEntry.u);
            this._v = this._v.add(this._currentEntry.v);
            var partialResult = this._current.beginAdd(this._currentEntry.p);
            if (partialResult.result == undefined) {
                return partialResult;
            }
            this.setCurrent(partialResult.result);
            return null;
        }

        endStep(lambda: ModNumber): void {
            this.setCurrent(this._current.endAdd(this._currentEntry.p, lambda));
        }

        private setCurrent(point: ModPoint): void {
            var reflected = point.negate();
            if (point.compareY(reflected) == 1) {
                // take the smallest y
                point = reflected;
            }

            if (this._config.computePointsUniqueFraction) {
                this._allPoints.add(point);
            }
            this._current = point;
        }
    }

    export class MultiCurveWalk implements CurveWalk {
        private _walks: SingleCurveWalk[];

        constructor(config: IConfig, table: Addition.Table) {
            this._walks = Array<SingleCurveWalk>(config.parrallelWalksCount);
            for (var n = 0; n < this._walks.length; n++) {
                this._walks[n] = new SingleCurveWalk(config, table);
            }
        }

        step(): void {
            var x = Array<ModPointAddPartialResult>(this._walks.length);

            for (var n = 0; n < this._walks.length; n++) {
                x[n] = this._walks[n].beginStep();
            }

            // Bit of a hack here, since some x[n] need not be inverted (the result could already be computed, without inversion)
            // so we have to keep track both of the actual iterating index from x[],
            // and of the one from the new arrays that may contain less elements

            var a = Array<ModNumber>();
            a[0] = x[0].denominator;
            for (var n = 1, realN = n; n < this._walks.length; n++) {
                if (x[n] != null) {
                    a[realN] = a[realN - 1].mul(x[n].denominator);
                    realN++;
                }
            }

            var xinv = Array<ModNumber>(a.length);
            var ainv = Array<ModNumber>(a.length);
            ainv[a.length - 1] = a[a.length - 1].invert();
            for (var n = this._walks.length - 1, realN = ainv.length - 1; realN > 0; n--) {
                if (x[n] != null) {
                    xinv[realN] = ainv[realN].mul(a[realN - 1]);
                    ainv[realN - 1] = ainv[realN].mul(x[n].denominator);
                    realN--;
                }
            }
            xinv[0] = ainv[0];

            for (var n = 0, realN = 0; n < this._walks.length; n++) {
                if (x[n] != null) {
                    var lambda = x[n].numerator.mul(xinv[realN]);
                    this._walks[n].endStep(lambda);
                    realN++;
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

export = PollardRho;