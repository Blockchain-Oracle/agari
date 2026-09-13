import { ORACLE_EXPLORER_URL } from "../constants/chain";

/** The oracle's own resolution graph for one question — sources, values, median, quorum (FR-21). */
export function oracleGraphUrl(oracleQuestionId: string, oracleBase: string = ORACLE_EXPLORER_URL): string {
  return `${oracleBase}/questions/${oracleQuestionId}?view=graph`;
}
