﻿import ModNumber = require("ModNumber");
import ModCurve = require("ModCurve");

class ModPoint {
    private static INFINITY = new ModPoint(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, null);

    private x: ModNumber;
    private y: ModNumber;
    private curve: ModCurve;

    constructor(x: number, y: number, curve: ModCurve) {
        if (curve == null) {
            return; // hack-y
        }

        this.x = new ModNumber(x, curve.N);
        this.y = new ModNumber(y, curve.N);
        this.curve = curve;

        this.ensureValid();
    }


    get X(): ModNumber {
        return this.x;
    }

    get Y(): ModNumber {
        return this.y;
    }

    get Curve(): ModCurve {
        return this.curve;
    }


    add(other: ModPoint): ModPoint {
        // Case 1: One of the points is infinity -> return the other
        if (this == ModPoint.INFINITY) {
            return other;
        }
        if (other == ModPoint.INFINITY) {
            return this;
        }

        // Case 2: The points are vertically symmetric -> return infinity
        if (this.x.eq(other.x) && this.y.eq(other.y.negate())) {
            return ModPoint.INFINITY;
        }

        var lambda: ModNumber;
        if (this.eq(other)) {
            // Case 3: The points are equal -> double the current point
            var num = this.x.pow(2).mulNum(3).add(this.curve.A);
            var denom = this.y.mulNum(2);
            lambda = num.div(denom);
        } else {
            // Case 4: Add the two points
            var num = other.y.sub(this.y);
            var denom = other.x.sub(this.x);
            lambda = num.div(denom);
        }

        var x = lambda.pow(2).sub(this.x).sub(other.x);
        var y = lambda.mul(this.x.sub(x)).sub(this.y);

        return new ModPoint(x.Value, y.Value, this.curve);
    }

    mul(n: ModNumber): ModPoint {
        var g = ModPoint.INFINITY;
        for (var _ = 0; _ < n.Value; _++) {
            g = g.add(this);
        }
        return g;
    }

    partition(count: number): number {
        if (this == ModPoint.INFINITY) {
            return 0;
        }
        return this.x.Value % count;
    }

    eq(other: ModPoint): boolean {
        return this == other || (this.x.eq(other.x) && this.y.eq(other.y));
    }


    toString(): string {
        if (this == ModPoint.INFINITY) {
            return "Infinity";
        }
        return "(" + this.x.Value + ", " + this.y.Value + ")";
    }


    private ensureValid(): void {
        if (!this.y.pow(2).eq(this.x.pow(3).add(this.curve.A.mul(this.x)).add(this.curve.B))) {
            throw (this + " is not a valid point.");
        }
    }
}

export = ModPoint;