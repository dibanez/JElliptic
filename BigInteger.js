﻿define(["require", "exports"], function(require, exports) {
    var BigInteger = (function () {
        function BigInteger() {
        }
        /** O(1) */
        BigInteger.fromInt = function (n) {
            if (Math.abs(n) > BigInteger.MAX_SAFE_INT) {
                throw "BigInteger.fromInt cannot be called with inexact integers.";
            }

            var sign = n >= 0 ? 1 : -1;
            var digits = Array();

            n = Math.abs(n);

            do {
                var rem = n % BigInteger.BASE;
                n = Math.floor(n / BigInteger.BASE);

                digits.push(rem);
            } while(n != 0);

            return BigInteger.create(sign, digits);
        };

        /** O(str.length) */
        BigInteger.parse = function (str) {
            // This is a bit too complex for bases that are powers of ten, but it works with any base
            var sign = 1;
            if (str[0] == "-") {
                sign = -1;
                str = str.substring(1);
            }

            var digits = Array();
            var currentDigit = 0;
            var currentMul = 1;

            for (var n = str.length - 1; n >= 0; n--) {
                currentDigit += parseInt(str[n], 10) * currentMul;
                currentMul *= 10;

                if (currentMul >= BigInteger.BASE) {
                    var nextDigit = Math.floor(currentDigit / BigInteger.BASE);
                    currentDigit %= BigInteger.BASE;

                    digits.push(currentDigit);

                    currentDigit = nextDigit;
                    currentMul = 1;
                }
            }

            if (currentDigit != 0) {
                digits.push(currentDigit % BigInteger.BASE);
                digits.push(Math.floor(currentDigit / BigInteger.BASE));
            }

            return BigInteger.create(sign, digits);
        };

        /** O(1) */
        BigInteger.prototype.negate = function () {
            return BigInteger.create(-this._sign, this._digits.slice(0));
        };

        /** O(1) */
        BigInteger.prototype.abs = function () {
            if (this._sign == 1) {
                return this;
            }
            return BigInteger.create(1, this._digits.slice(0));
        };

        /** O(this.digits)
        Rounds down. */
        BigInteger.prototype.halve = function () {
            var digits = new Array(this._digits.length);
            var hasRest = false;
            for (var n = this._digits.length - 1; n >= 0; n--) {
                digits[n] = Math.floor(this._digits[n] / 2);
                if (hasRest) {
                    digits[n] += BigInteger.BASE / 2;
                }
                hasRest = this._digits[n] % 2 == 1;
            }

            return BigInteger.create(this._sign, digits);
        };

        /** O(max(this.digits, other.digits)) */
        BigInteger.prototype.add = function (other) {
            var thisAbs = this.abs();
            var otherAbs = other.abs();
            var thisIsGreater = thisAbs.compare(otherAbs) == 1 || thisAbs.eq(otherAbs) && this._sign == 1;
            var hi = thisIsGreater ? this : other;
            var lo = thisIsGreater ? other : this;

            var digits = Array();
            var loSign = hi._sign == lo._sign ? 1 : -1;

            var carry = 0;

            for (var n = 0; n < hi._digits.length; n++) {
                var current = hi._digits[n] + loSign * (lo._digits[n] || 0) + carry;

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

            if (carry != 0) {
                digits[hi._digits.length] = carry;
            }

            return BigInteger.create(hi._sign, digits);
        };

        /** O(max(this.digits, other.digits)) */
        BigInteger.prototype.sub = function (other) {
            return this.add(other.negate());
        };

        /** O(max(this.digits, other.digits)^log_2(3)) */
        BigInteger.prototype.mul = function (other) {
            function singleDigitMul(bi, mul, mulSign) {
                var digits = Array();
                var carry = 0;
                for (var n = 0; n < bi._digits.length; n++) {
                    var digit = bi._digits[n] * mul + carry;
                    carry = Math.floor(digit / BigInteger.BASE);
                    digit %= BigInteger.BASE;
                    digits.push(digit);
                }
                if (carry != 0) {
                    digits.push(carry);
                }

                return BigInteger.create(mulSign * bi._sign, digits);
            }

            if (this._digits.length == 1) {
                return singleDigitMul(other, this._digits[0], this._sign);
            }

            if (other._digits.length == 1) {
                return singleDigitMul(this, other._digits[0], other._sign);
            }

            // http://en.wikipedia.org/wiki/Karatsuba_algorithm
            var m = Math.max(this._digits.length, other._digits.length);
            var m2 = Math.ceil(m / 2);

            var lo1 = BigInteger.create(this._sign, this._digits.slice(0, m2));
            var hi1 = BigInteger.create(this._sign, this._digits.slice(m2));
            var lo2 = BigInteger.create(other._sign, other._digits.slice(0, m2));
            var hi2 = BigInteger.create(other._sign, other._digits.slice(m2));

            var z0 = lo1.mul(lo2);
            var z1 = lo1.add(hi1).mul(lo2.add(hi2));
            var z2 = hi1.mul(hi2);

            return (z2.leftShift(m2 * 2)).add(z1.sub(z2).sub(z0).leftShift(m2)).add(z0);
        };

        /** O(this.digits^2) */
        BigInteger.prototype.div = function (divisor) {
            function divide(dividend, divisor) {
                if (dividend.eq(BigInteger.ZERO)) {
                    return BigInteger.ZERO;
                }

                var low = BigInteger.ONE;
                var high = dividend;

                while (low.compare(high) == -1) {
                    var guess = low.add(high).halve();
                    if (dividend.sub(divisor.mul(guess)).compare(divisor) > -1) {
                        low = guess.add(BigInteger.ONE);
                    } else {
                        high = guess;
                    }
                }

                return low;
            }

            var sign = this._sign * divisor._sign;
            divisor = divisor.abs();
            var dividend = this.abs();

            if (dividend.compare(divisor) == -1) {
                return BigInteger.ZERO;
            }

            var digits = new Array();

            // First, take digits from the biggest one until the number they form is bigger than the divisor
            var index;
            var remainder;
            for (index = dividend._digits.length - divisor._digits.length; index >= 0; index--) {
                var shifted = dividend.rightShiftAbs(index);
                if (shifted.compare(divisor) > -1) {
                    // Divide that number by the divisor, store the quotient, and keep the remainder
                    var quotient = divide(shifted, divisor);
                    remainder = shifted.sub(quotient.mul(divisor));
                    digits.unshift(quotient.toInt());
                    index--;
                    break;
                }
            }

            for (; index >= 0; index--) {
                var newDigit = dividend._digits[index];
                var newDividend = remainder.pushRight(newDigit);
                var quotient = divide(newDividend, divisor);
                remainder = newDividend.sub(quotient.mul(divisor));
                digits.unshift(quotient.toInt());
            }

            return BigInteger.create(sign, digits);
        };

        /** O(log(this)) */
        BigInteger.prototype.mod = function (n) {
            var low = BigInteger.ZERO;
            var high = this.abs();

            if (this._sign == 1) {
                while (low.compare(high) == -1) {
                    var guess = low.add(high).halve();
                    if (this.sub(n.mul(guess)).compare(n) > -1) {
                        low = guess.add(BigInteger.ONE);
                    } else {
                        high = guess;
                    }
                }

                return this.sub(n.mul(low));
            } else {
                while (low.compare(high) == -1) {
                    var guess = low.add(high).halve();
                    var result = this.add(n.mul(guess));
                    if (result._sign == 1) {
                        if (result.compare(n) == -1) {
                            return result;
                        } else {
                            high = guess;
                        }
                    } else {
                        low = guess.add(BigInteger.ONE);
                    }
                }

                return this.add(n.mul(low));
            }
        };

        /** O(log(n)^2) */
        BigInteger.prototype.modInverse = function (n) {
            var t = BigInteger.ZERO, newt = BigInteger.ONE;
            var r = n, newr = this;
            while (!newr.eq(BigInteger.ZERO)) {
                var quotient = r.div(newr);

                var oldt = t;
                t = newt;
                newt = oldt.sub(quotient.mul(newt));

                var oldr = r;
                r = newr;
                newr = oldr.sub(quotient.mul(newr));
            }
            if (r.compare(BigInteger.ONE) == 1) {
                throw (this + " is not invertible");
            }
            if (t._sign == -1) {
                t = t.add(n);
            }
            return t;
        };

        /** O(min(this.digits, other.digits)) */
        BigInteger.prototype.compare = function (other) {
            if (this._sign < other._sign) {
                return -1;
            }
            if (this._sign > other._sign) {
                return 1;
            }
            if (this._digits.length < other._digits.length) {
                return -this._sign;
            }
            if (this._digits.length > other._digits.length) {
                return this._sign;
            }
            for (var n = this._digits.length - 1; n >= 0; n--) {
                if (this._digits[n] < other._digits[n]) {
                    return -this._sign;
                }
                if (this._digits[n] > other._digits[n]) {
                    return this._sign;
                }
            }
            return 0;
        };

        /** O(min(this.digits, other.digits)) */
        BigInteger.prototype.and = function (other) {
            var digits = Array();

            for (var n = 0; n < this._digits.length && n < other._digits.length; n++) {
                digits.push(this._digits[n] & other._digits[n]);
            }

            return BigInteger.create(1, digits);
        };

        /** O(min(this.digits, other.digits)) */
        BigInteger.prototype.eq = function (other) {
            function arrayEquals(a, b) {
                if (a == b) {
                    return true;
                }
                if (a.length != b.length) {
                    return false;
                }

                for (var i = 0; i < a.length; ++i) {
                    if (a[i] != b[i]) {
                        return false;
                    }
                }
                return true;
            }

            return this._sign == other._sign && arrayEquals(this._digits, other._digits);
        };

        /** O(this.digits) */
        BigInteger.prototype.toInt = function () {
            // Hack-y, but simple
            var str = this.toString();
            var n = parseInt(str);
            if (Math.abs(n) > BigInteger.MAX_SAFE_INT) {
                throw "toInt can only work with small BigIntegers.";
            }

            return n;
        };

        /** O(this.digits) */
        BigInteger.prototype.toString = function () {
            var padNum = function (n, len) {
                var str = n.toString();
                while (str.length < len) {
                    str = '0' + str;
                }
                return str;
            };

            var result = "";

            for (var n = 0; n < this._digits.length - 1; n++) {
                result = padNum(this._digits[n], BigInteger.BASE_LOG10) + result;
            }
            result = this._digits[this._digits.length - 1].toString() + result;

            if (this._sign == -1) {
                result = "-" + result;
            }

            return result;
        };

        /** O(this.digits + n) */
        BigInteger.prototype.leftShift = function (n) {
            var digits = new Array(this._digits.length + n);

            for (var i = 0; i < n; i++) {
                digits[i] = 0;
            }

            for (var i = 0; i < this._digits.length; i++) {
                digits[i + n] = this._digits[i];
            }

            return BigInteger.create(this._sign, digits);
        };

        /** O(this.digits + n) */
        BigInteger.prototype.pushRight = function (n) {
            var digits = new Array(this._digits.length + 1);

            digits[0] = n;
            for (var i = 0; i < this._digits.length; i++) {
                digits[i + 1] = this._digits[i];
            }

            return BigInteger.create(this._sign, digits);
        };

        /** O(this.digits + n) */
        BigInteger.prototype.rightShiftAbs = function (n) {
            var digits = new Array(this._digits.length - n);

            for (var i = 0; i < digits.length; i++) {
                digits[i] = this._digits[i + n];
            }

            return BigInteger.create(1, digits);
        };

        /** O(digits) */
        BigInteger.create = function (sign, digits) {
            // Remove useless digits
            var actualLength = digits.length;
            while (actualLength > 0 && digits[actualLength - 1] == 0) {
                actualLength--;
            }

            if (actualLength == 0) {
                return BigInteger.ZERO;
            }

            var bi = new BigInteger();
            bi._sign = sign;
            bi._digits = digits.slice(0, actualLength);
            return bi;
        };

        /** O(1) */
        BigInteger.uncheckedCreate = function (sign, digits) {
            var bi = new BigInteger();
            bi._sign = sign;
            bi._digits = digits;
            return bi;
        };
        BigInteger.MAX_SAFE_INT = 9007199254740991;
        BigInteger.BASE = 10000000;
        BigInteger.BASE_LOG10 = Math.floor(Math.log(BigInteger.BASE) / Math.log(10));

        BigInteger.ZERO = BigInteger.uncheckedCreate(1, [0]);
        BigInteger.ONE = BigInteger.uncheckedCreate(1, [1]);
        BigInteger.TWO = BigInteger.uncheckedCreate(1, [2]);
        return BigInteger;
    })();

    
    return BigInteger;
});
//# sourceMappingURL=BigInteger.js.map