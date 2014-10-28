﻿/// <reference path="lib/require.d.ts" />
define(["require", "exports", "BigInteger", "ModCurve", "PollardRho"], function(require, exports, BigInteger, ModCurve, PollardRho) {
    function bigintValue(elemName) {
        return BigInteger.parse(document.getElementById(elemName).value);
    }

    requirejs([], function () {
        var btn = document.getElementById("button");

        btn.onclick = function (_) {
            var a = bigintValue("a"), b = bigintValue("b"), n = bigintValue("order");
            var gx = bigintValue("gx"), gy = bigintValue("gy");
            var hx = bigintValue("hx"), hy = bigintValue("hy");

            var config = {
                curve: new ModCurve(a, b, n),
                additionTableSeed: 0,
                additionTableLength: 128,
                parrallelWalksCount: 10,
                useNegationMap: true,
                distinguishedPointMask: BigInteger.fromInt(3)
            };

            PollardRho.run(gx, gy, hx, hy, config);
        };
    });
});
//# sourceMappingURL=app.js.map