"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchUtils = void 0;
const branch_constants_1 = require("../constants/branch.constants");
class BranchUtils {
    static getBranchName(branchId) {
        return branch_constants_1.BRANCH_ID_TO_NAME[branchId] || null;
    }
    static getBranchToken(branchId) {
        return branch_constants_1.BRANCH_ID_TO_TOKEN[branchId] || null;
    }
}
exports.BranchUtils = BranchUtils;
