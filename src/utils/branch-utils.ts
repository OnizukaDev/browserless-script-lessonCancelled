import {
  BRANCH_ID_TO_NAME,
  BRANCH_ID_TO_TOKEN,
} from "../constants/branch.constants";

export class BranchUtils {
  static getBranchName(branchId: string | number): string | null {
    return BRANCH_ID_TO_NAME[branchId] || null;
  }

  static getBranchToken(branchId: string | number): string | null {
    return BRANCH_ID_TO_TOKEN[branchId] || null;
  }
}
