﻿class BigInteger {
    private static MAX_INT = 9007199254740991; // 2^53-1, where 53 is the mantissa size of IEEE-754 double-precision floating point numbers (what JS uses)
    private static BASE = 1000000000000000; // largest representable power of 10
    private static DIGIT_LENGTH = 15; // number of base-10 digits allowed in our own digits


    private sign: number; // -1 or 1; zero always has 1 as a sign
    private digits: number[]; // base BASE


    static Zero = BigInteger.create(1, [0]);
    static One = BigInteger.create(1, [1]);


    static fromInt(n: number): BigInteger {
        if (n > BigInteger.MAX_INT) {
            throw "BigInteger.fromInt(number) cannot be called with inexact integers.";
        }

        var sign = n >= 0 ? 1 : -1;
        n = Math.abs(n);
        var lo = n % BigInteger.BASE;
        var hi = n / BigInteger.BASE;

        var bi = new BigInteger();
        bi.sign = sign;
        if (hi > 0) {
            bi.digits = [hi, lo];
        } else {
            bi.digits = [lo];
        }
        return bi;
    }

    static parse(str: string): BigInteger {
        var sign = 1;
        if (str[0] == "-") {
            sign = -1;
            str = str.substring(1);
        }

        var chunksLength = Math.ceil(str.length / BigInteger.DIGIT_LENGTH);
        var chunks: string[] = [];

        for (var n = 0; n < chunksLength; n++) {
            var begin = n * BigInteger.DIGIT_LENGTH;
            chunks[n] = str.substring(begin, Math.min(BigInteger.DIGIT_LENGTH, str.length - begin));
        }

        return BigInteger.create(sign, chunks.map(parseInt));
    }


    negate(): BigInteger {
        return BigInteger.create(-this.sign, this.digits);
    }

    abs(): BigInteger {
        return BigInteger.create(1, this.digits);
    }


    add(other: BigInteger): BigInteger {
        var thisIsGreater = this.gte(other);
        var hi = thisIsGreater ? this : other;
        var lo = thisIsGreater ? other : this;

        var digits: number[] = [];
        var loSign = hi.sign == lo.sign ? 1 : -1;

        var carry: number = 0;

        for (var n = 0; n < hi.digits.length; n++) {
            var current = hi.digits[n] + loSign * (lo.digits[n] || 0) + carry;

            if (current >= BigInteger.BASE) {
                carry = 1;
                current -= BigInteger.BASE;
            } else if (current < 0) {
                carry = -1;
                current += BigInteger.BASE;
            } else {
                carry = 0;
            }

            digits[n] = current;
        }

        // at the end carry is always >= 0
        if (carry != 0) {
            digits[hi.digits.length] = carry;
        }

        return BigInteger.create(hi.sign, digits);
    }

    sub(other: BigInteger): BigInteger {
        return this.add(other.negate());
    }

    // http://en.wikipedia.org/wiki/Karatsuba_algorithm
    mul(other: BigInteger): BigInteger {
        // this function assumes num1 and num2 are both >0
        var MAX_FOR_BUILTIN_MUL = Math.pow(10, BigInteger.DIGIT_LENGTH / 2);
        function karatsuba(num1: BigInteger, num2: BigInteger): BigInteger {
            if (num1.digits.length == 1 && num1.digits[0] < MAX_FOR_BUILTIN_MUL && num2.digits.length == 1 && num2.digits[0] < MAX_FOR_BUILTIN_MUL) {
                return BigInteger.create(num1.sign * num2.sign, [num1.digits[0] * num2.digits[0]]);
            }

            var m = Math.max(num1.digits.length, num2.digits.length);
            var m2 = m / 2;

            var lo1 = BigInteger.create(1, num1.digits.slice(0, m2));
            var hi1 = BigInteger.create(1, num1.digits.slice(m2, num1.digits.length));
            var lo2 = BigInteger.create(1, num2.digits.slice(0, m2));
            var hi2 = BigInteger.create(1, num2.digits.slice(m2, num2.digits.length));

            var z0 = karatsuba(lo1, lo2);
            var z1 = karatsuba(lo1.add(hi1), lo2.add(hi2));
            var z2 = karatsuba(hi1, hi2);

            var r1 = z2.leftShift(m2);
            var r2 = z1.sub(z2).sub(z0).leftShift(m2);

            return r1.add(r2).add(z0);
        }

        return BigInteger.create(this.sign * other.sign, karatsuba(this.abs(), other.abs()).digits);
    }

    // Simple long division, sufficient for now
    div(other: BigInteger): BigInteger {
        var quotient = this;
        var result = BigInteger.Zero;

        while (quotient.gte(other)) {
            quotient = quotient.sub(other);
            result = result.add(BigInteger.One);
        }

        return result;
    }

    mod(other: BigInteger): BigInteger {
        var result = this;

        if (this.sign == 1) {
            while (result.gte(other)) {
                result = result.sub(other);
            }
        } else {
            while (BigInteger.Zero.gte(result)) {
                result = result.add(other);
            }
        }

        return result;
    }

    gte(other: BigInteger): boolean {
        if (this.digits.length > other.digits.length) {
            return true;
        }
        if (other.digits.length > this.digits.length) {
            return false;
        }
        return this.digits[this.digits.length - 1] >= other.digits[other.digits.length - 1];
    }

    leftShift(n: number): BigInteger {
        var digits = this.digits.slice(0); // slice(0) creates a clone
        for (var _ = 0; _ < n; _++) {
            digits.unshift(0);
        }
        return BigInteger.create(this.sign, digits);
    }


    toString(): string {
        var result = "";

        if (this.sign == -1) {
            result += "-";
        }

        for (var digit in this.digits) {
            result += digit.toString();
        }

        return result;
    }


    private static create(sign: number, digits: number[]): BigInteger {
        var bi = new BigInteger();
        bi.sign = sign;
        bi.digits = digits;
        return bi;
    }
}

export = BigInteger;