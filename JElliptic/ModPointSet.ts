﻿import ModPoint = require("ModPoint");

class ModPointSet {
    private static BUCKET_COUNT = 32;

    private _buckets: ModPoint[][];
    private _containsInfinity: boolean;
    private _totalCount: number;
    private _duplicatesCount: number;

    constructor() {
        this._buckets = [];
        for (var n = 0; n < ModPointSet.BUCKET_COUNT; n++) {
            this._buckets[n] = new Array<ModPoint>();
        }

        this._containsInfinity = false;
        this._totalCount = 0;
        this._duplicatesCount = 0;
    }

    contains(point: ModPoint): boolean {
        if (point == ModPoint.INFINITY) {
            return this._containsInfinity;
        }

        var hash = point.x.value.partition(ModPointSet.BUCKET_COUNT);
        var bucket = this._buckets[hash];
        for (var n = 0; n < bucket.length; n++) {
            if (point.eq(bucket[n])) {
                return true;
            }
        }
        return false;
    }

    add(point: ModPoint): boolean {
        this._totalCount++;

        if (this.contains(point)) {
            this._duplicatesCount++;
            return false;
        }

        if (point == ModPoint.INFINITY) {
            this._containsInfinity = true;
            return true;
        }

        var hash = point.x.value.partition(ModPointSet.BUCKET_COUNT);
        this._buckets[hash].push(point);
        return true;
    }

    toString(): string {
        return this._totalCount + " points, " + (this._duplicatesCount / this._totalCount * 100) + "% of which are duplicates.";
    }
}

export = ModPointSet;