import { config } from "../config";

export const BRANCH_ID_TO_NAME: { [key: string]: string } = {
  3268: "Tutorax - Tutorat",
  5737: "Tutorax - Stimulation du langage",
  7673: "Tutorax - Canada",
  8427: "Tutorax - Orthopédagogie",
  15751: "Tutorax - USA",
  3269: "Tutorax Administration",
  14409: "Tutorax - Orthophonie",
};

export const BRANCH_ID_TO_TOKEN: { [key: string]: string } =
  config.branchTokens;
