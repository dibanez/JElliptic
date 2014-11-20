﻿/// <reference path="lib/qunit.d.ts" />
define(["require", "exports", "BigInteger", "ModNumber"], function(require, exports, BigInteger, ModNumber) {
    var ModNumberTests;
    (function (ModNumberTests) {
        function run() {
            QUnit.module("ModNumber");

            test("constructor value is modulo-ed", function () {
                var num = new ModNumber(BigInteger.fromInt(10), BigInteger.fromInt(3));

                ok(num.value.eq(BigInteger.fromInt(1)));
            });
        }
        ModNumberTests.run = run;
    })(ModNumberTests || (ModNumberTests = {}));

    
    return ModNumberTests;
});
//# sourceMappingURL=ModNumberTests.js.map