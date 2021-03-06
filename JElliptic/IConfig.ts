﻿"use strict";

import BigInteger = require("BigInteger");
import ModCurve = require("ModCurve");
import ModPoint = require("ModPoint");

interface IConfig {
    curve: ModCurve;
    generator: ModPoint;
    target: ModPoint;
    additionTableSeed: number;
    additionTableLength: number;
    parrallelWalksCount: number;
    distinguishedPointMask: BigInteger;
    computeStats: boolean;
    checkCyclePeriod: number;
    checkCycleLength: number;
}

export = IConfig;