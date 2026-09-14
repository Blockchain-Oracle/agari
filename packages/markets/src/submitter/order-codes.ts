/** `user_place_order` argument codes (events-engine.md §2, §3.1–3.2). */
export const ORDER_KIND = { buyYes: 0, sellYes: 1, buyNo: 2, sellNo: 3 } as const;
export const ORDER_TYPE = { normal: 0, fok: 1, ioc: 2, postOnly: 3 } as const;
/** Self-match policy 0: a taker meeting its own live order reverts (`SelfMatchCancelTaker`). */
export const SELF_MATCH_CANCEL_TAKER = 0;
