﻿"use strict";

import BigInteger = require("BigInteger");
import ModNumber = require("ModNumber");
import ModCurve = require("ModCurve");
import ModPointAddPartialResult = require("ModPointAddPartialResult");

class ModPoint {
    private static INF = new ModPoint(null, null, null);

    private _x: ModNumber;
    private _y: ModNumber;
    private _curve: ModCurve;


    constructor(x: ModNumber, y: ModNumber, curve: ModCurve) {
        this._x = x;
        this._y = y;
        this._curve = curve;
    }

    static fromBigInts(x: BigInteger, y: BigInteger, curve: ModCurve): ModPoint {
        return new ModPoint(ModNumber.create(x, curve.n),ModNumber.create(y, curve.n), curve);
    }


    get x(): ModNumber {
        return this._x;
    }

    get y(): ModNumber {
        return this._y;
    }

    static get INFINITY(): ModPoint {
        return ModPoint.INF;
    }


    /** O(1) */
    negate(): ModPoint {
        if (this == ModPoint.INF) {
            return this;
        }
        return new ModPoint(this._x, this._y.negate(), this._curve);
    }

    add(other: ModPoint): ModPoint {
        var partial = this.beginAdd(other);
        if (partial.result != null) {
            return partial.result;
        }
        return this.endAdd(other, partial.numerator.div(partial.denominator));
    }

    beginAdd(other: ModPoint): ModPointAddPartialResult {
        // Case 1: One of the points is infinity -> return the other
        if (this == ModPoint.INF) {
            return new ModPointAddPartialResult(null, null, other);
        }
        if (other == ModPoint.INF) {
            return new ModPointAddPartialResult(null, null, this);
        }

        // Case 2: The points are vertically symmetric -> return infinity
        if (this._x.compare(other._x) == 0
         && this._y.compare(other._y.negate()) == 0) {
            return new ModPointAddPartialResult(null, null, ModPoint.INF);
        }

        var num: ModNumber, denom: ModNumber;
        if (this.eq(other)) {
            // Case 3: The points are equal -> double the current point
            num = this._x.square().mulNum(3).add(this._curve.a);
            denom = this._y.mulNum(2);
        } else {
            // Case 4: Add the two points
            num = other._y.sub(this._y);
            denom = other._x.sub(this._x);
        }

        return new ModPointAddPartialResult(num, denom, null);
    }

    endAdd(other: ModPoint, lambda: ModNumber): ModPoint {
        var x = lambda.square().sub(this._x).sub(other._x);
        var y = lambda.mul(this._x.sub(x)).sub(this._y);

        return new ModPoint(x, y, this._curve);
    }

    /** O(n) */
    mulNum(n: number): ModPoint {
        var result = ModPoint.INF;
        var currentAdding = this;

        while (n != 0) {
            if ((n & 1) == 1) {
                result = result.add(currentAdding);
            }

            n >>= 1;
            if (n != 0) {
                // This is expensive, don't do it if we're not going to use it
                currentAdding = currentAdding.add(currentAdding);
            }
        }

        return result;
    }

    /** O(this.value.digits / n) */
    partition(n: number): number {
        if (this == ModPoint.INF) {
            return 0;
        }
        return this._x.value.partition(n);
    }

    compareY(other: ModPoint): number {
        if (this == ModPoint.INF) {
            return other == ModPoint.INF ? 0 : 1;
        }
        if (other == ModPoint.INF) {
            return -1;
        }

        return this._y.compare(other._y);
    }

    /** O(min(this.x.value.digits, other.x.value.digits) + min(this.y.value.digits, other.y.value.digits)) */
    eq(other: ModPoint): boolean {
        if (this == ModPoint.INF) {
            return other == ModPoint.INF;
        }
        if (other == ModPoint.INF) {
            return false;
        }

        return this._x.compare(other._x) == 0
            && this._y.compare(other._y) == 0;
    }

    /** O(this.x.value.digits + this.y.value.digits) */
    toString(): string {
        if (this == ModPoint.INF) {
            return "Infinity";
        }
        return "(" + this._x.value.toString() + ", " + this._y.value.toString() + ")";
    }
}

export = ModPoint;