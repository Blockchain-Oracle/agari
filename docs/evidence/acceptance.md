# Agari transaction evidence

Dated, selected proof for the README and [track notes](../submission/tracks.md), reviewed on **23 September 2026**. Devnet links point to Solana Explorer. They show transactions at the named time; they do not prove that a service or feed is healthy now. The working team's full operations journal remains local.

## Venue and price rules

| Date (UTC) | Observed action | Network | Evidence |
| --- | --- | --- | --- |
| 14 Sep | Event program deployed | Devnet | [Deploy](https://explorer.solana.com/tx/535nHdsRyvVbmuKVHPsuaBV9HCVEcfkTRbZnk2Gpr35DSnC8SAsFzkDJnm4qW6L6EKptVSrNzuhHkwzQ56hKRpQS?cluster=devnet) |
| 14 Sep | Up/Down book opened for TSLA | Devnet | [Open](https://explorer.solana.com/tx/3tMvXbgGmHGXjsYJXTEZ1pTPzgbBKgAeokvv9wngbvDbwr2n9C8ZSjSCZVruqtdvUCx6oZWg9NiQfjzxFUQhPe4V?cluster=devnet) |
| 14 Sep | Direct fill, complete-pair mint and pair burn exercised | Devnet | [Direct](https://explorer.solana.com/tx/5eyinbbRXKEW2nYYHRVJLBpqiQrU2hKDu36KVjEAUEUn6QeYsLQyy2bZANgdmuHJZPoaYbbmJwyUdJAPLGy62hCn?cluster=devnet) · [Mint](https://explorer.solana.com/tx/5n12bZvvyxk8DA8ja4Sh5DzDGziGALoDPdK2CHRK9jPHCTJPfzwg7gZPfoRz9bNcur3ySxpfgxKCYTcYkfmnGMaN?cluster=devnet) · [Burn](https://explorer.solana.com/tx/3N2iJLzyc5vdv6WcX6EFEQ5yGPdXGbVTZe9aesfrN3UM7JqqY28rtsMztESuuwWfhVDn8dZVuxXhpa3oKKaki3CH?cluster=devnet) |
| 14 Sep | TSLA settled Up after Pyth and RedStone boundary prints | Devnet | [Settlement](https://explorer.solana.com/tx/xjKyBjRk51GitA35CZoP6fKd9huZ15EMH5RPmv8Lkj6XCKYn71zUDFfJaQPHyyresAX4Es13UCFGs4GSogvmzwt?cluster=devnet) |
| 14 Sep | Divergent price sources caused a void | Devnet | [CrossCheckDivergence](https://explorer.solana.com/tx/24R75m6PE6NohCTE1Z6t3oQvReGP628DVdUsEMM3kKs7gHFWmhTeA32QUKvJEWeWeUW8VzN8VSdQo2rrkCebHYaj?cluster=devnet) |
| 14 Sep | Missing print caused a void | Devnet | [MissingPrint](https://explorer.solana.com/tx/3p3AwjvW66Y24cV97pPYH4CR7ftXeuFH7GYBeWXhsVCmf1htuSpoYXTNz1nSL7kZhPdmBw1wGB1sFmPQpMM2G1WH?cluster=devnet) |
| 14 Sep | A settled seat redeemed | Devnet | [Redeem](https://explorer.solana.com/tx/3VFzTVV7FJkaksFDrQtsuJFfaT437SKBx6Gwd93fPLnken3Fuv7tDjpYNq3rA5nQtTKppincNuwWWoDhcJR1SURg?cluster=devnet) |

## PreStocks user paths

| Date (UTC) | Observed action | Network | Evidence |
| --- | --- | --- | --- |
| 19 Sep, 10:58–11:00 | OpenAI one-hour Window opened unattended and recorded its PreStocks opening print through Agari's attestor | Devnet | [Open](https://explorer.solana.com/tx/2PTZDJ5yY9oEmJKCQUcdNrweZj5qPnx3veo2BvBrsbSnMjxkntwh21rP5S4o3fUpjZCV3sKHVzN6AA9AKr3so1dH?cluster=devnet) · [print](https://explorer.solana.com/tx/4TJTb2gTRkpg6p3HHG7WDKRYcTdzLxyz3zC23dLNF3zLUZksP12DB3B2yiixYq96WZTHHmmfGEfsAUN3j5yCXwPT?cluster=devnet) |
| 19 Sep, 11:31 | A wallet bought a 1,000-lot Down cover on OpenAI for 14.4¢ per lot | Devnet | [Order](https://explorer.solana.com/tx/2zDFnFpvKv7FJQVaa7J6jd2FHZGCsKAKuboUemyGirKAaiZitcE1Z91cXFVVNWpFjMNS7HrpFoafbm1XtVXGaeGR?cluster=devnet) |
| 19 Sep, 12:00 | OpenAI closed Up; the Down cover lost its premium while the held token price rose | Devnet | [Settlement](https://explorer.solana.com/tx/3qkabKy8ZLyxd6RjR5rooguKp9XzKKE1Rtcs6Ds45xHL4uCBCiakMbTYJyMq2ywdedtpZCmVbB1E5ceSViFvqKHG?cluster=devnet) |
| 22 Sep, 20:00 | First AI Labs basket Window resolved Down from 1,267.38 to 1,110.43 points | Devnet | [Open print](https://explorer.solana.com/tx/3uny9WbbhHgjJhttornmJnsqaVKBRAz8oqkzV62MttCdkMb7Nz3R5ybF63jYZkt6A9QTk2A4pQJukSRasRiex8is?cluster=devnet) · [close print](https://explorer.solana.com/tx/2QMSv8YDQyEFSTQVSkgFv9q4GDtA4Hyz52vXP2GuKBrQegyPHbGNz8yeSCiwADpwduwrBzH63kx9SHHrAVqc2mTW?cluster=devnet) · [settle](https://explorer.solana.com/tx/5xkJKmS47fZBYRNyeJ83iffHTxzpE2vMr9SGBMvKb3eeN6wNh1xC3WeWYpknWAynR1mAjmKF2ZpVEWwRU3RuZm3f?cluster=devnet) |
| 22 Sep, 20:00 | First Defense & Space basket Window resolved Up from 980.93 to 988.06 points | Devnet | [Settle](https://explorer.solana.com/tx/YnwMzy8g1Fp6KkRrFTF3XHTEWhF7JgK4Y3FGAidnzR2B2uzYwgpe8SmPPafQqNcqUgvp9yjf721qghLrsznBdP4?cluster=devnet) |

## Desk boundary

On **22 September 2026**, the [desk rehearsal drive](../../scripts/drive/desk-rehearsal.ts) exercised program deployment, owner limits, two Jupiter buys, a sell, nine forced refusals, a decision hash chain and owner withdrawal on a **Surfpool fork of Solana mainnet**. The recorded drive completed 31 checks. Fork signatures are local to that run and have no public Explorer receipt. This is evidence of a rehearsal, not of a mainnet deployment or user funds in a live desk.

A production **paper** desk reads current PreStocks prices and Jupiter quotes but makes no real swap. The desk program has not been deployed on mainnet at this review.

## Native app: tap-trading with a phone session key (devnet, 25 September 2026)

The iOS app (simulator, practice wallet `CCmMaK7VninWM9tPxaktDfS5tnyYSEiJWwCyo3EjGuJn`) armed tap-trading and placed a tap trade that the owner's wallet did not sign.

| Time (UTC) | Transaction | What it proves |
| --- | --- | --- |
| 10:03:09 | `4AXUbwQsJbhCx8kAR8peHuMuiEn7X5XH2TDBXhKpqULbbVSiroBXBiYzCudeAHrSoy1wEuowsPco5TPhFTfMPTeL` | Arm: `OwnerOpenAccount` + `OwnerDepositAndGrant`, signed once by the owner; caps 5 tUSDC a tap, 25 a day, one day. |
| 10:23:24 | `2WM5bbSt6bDpM9JDUZVnaFPZqr43v9ezaKBeGWFZsu6MPKBoYdKr7fyGHe1e3TefGPjKMpQ4MCjmQkZgw15Xiukv` | A defect, since fixed: the ticket fell back to the owner's `UserPlaceOrder` because a 5m quote's padded limit exceeded the grant's 95¢ price cap (fix `99a0b67f`, `capQuoteToGrant`). |
| 10:33:05 | `5sR3h6kfHz9JxrkAGUi1JNNPUACiQzXAioxuWjkGCuz3zeNVCGMcKVJXpobY8LpEe5of5f5JNxnnD2PSfC7W2rxu` | Tap trade: `ActorPlaceFor` → `UserPlaceOrder`, signed by the phone's session key `4q2niNbpBGPRQf2UnPp4Ee9uSrFHV2oYhs3Br6BKuyiJ` with fees paid by the sponsor `5kKwdNLoxTX8vVaR4ekL9Pgtnc2vkTLeWawsaTdDfrru`; the owner is not a signer. 12.82 UP contracts on a QQQx 5m 24/7 Window at 5¢. |

Also on this wallet at 10:08:19, `65m4au8v6mNLcMBrVThMqJUrMfYTKMA9v3NryZdaR5L17CKTkDdCTswjWJ4fB1eWnTWxPoLEi21NPgd2A1nLiGtc` (`OwnerDepositAndGrant`) funded and authorised the X-trade balance with 5 tUSDC: an unintended tap during the drive, not a feature test.
