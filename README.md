# Allegis Shareholder Meeting

Wizer event for the Allegis AI simulation in Baltimore and Orlando. Participants move through a shared case and six moments. Three gauges sit on every screen: **AI Velocity**, **Team Trust**, and **Enterprise Value**. Each gauge starts at 50.

Copy, scores, and the room script come from `_dev/Content and Wireframe/Allegis Simulation Framework_For Digital.pptx`. Screen text and question definitions live in `Allegis_Shareholder_Meeting_MBS.csv`. Screens are the XML files in `Actions`.

## Room flow

The group director menu in `Actions/GD_Section_1.xml` runs in this order:

1. Welcome
2. Assign base values (writes 50 on all three gauges)
3. Team name (the leader types the name; followers wait)
4. Case context
5. Moment 1 — Prioritizing First Steps, then scores, then outcomes
6. Moment 2 — When Morale and Engagement Is Low, then scores, then outcomes
7. Moment 2B — When Relief Does Not Equal Repair, then the ranking outcome
8. Moment 3 — When a Team Has a Breakthrough Worth Scaling, then scores, then outcomes
9. Moment 4 — When Your Team Is Afraid of Being Replaced by AI, then outcomes
10. Moment 4 open response
11. Thank you

Only the team leader can submit. Followers see the same screen with the controls locked (`Q.Leader==2`).

The **Facilitator** tab opens results without moving the participant room: bar charts for Moments 1, 2, 3, and 4, the Moment 2B ranking chart, the open-response list, and the word cloud. The **Admin** tab is the reset screen.

## Scoring

| Moment | What participants do | Effect on the gauges |
| --- | --- | --- |
| 1 | Choose A–D | Updates all three gauges |
| 2 | Choose A–C | Updates all three gauges |
| 2B | Force-rank four factors | No gauge change. Option D is marked Optimal |
| 3 | Choose A–C | Updates all three gauges |
| 4 | Choose A–D | No gauge change. Outcomes only |
| 4 open response | Free text | No gauge change. Shown as a list and a word cloud |

Moment scores are applied from the aggregator buttons on the group director menu (`Activity1_Aggregator`, `Activity2_Aggregator`, `Activity4_Aggregator`). Each aggregator adds that moment’s deltas to the base 50 and to any earlier moment. The numeric key is `_dev/Scoring Sheet/Allegis Simulation Framework_Scoring.xlsx`.

A heatmap cell shows a tick when its question is `111`. That value is written for base values, a submitted Moment 2B ranking, and a submitted open response.

## Files

- `Allegis_Shareholder_Meeting_MBS.csv` — questions, sections, and every `!{Key}` string.
- `Actions/` — one screen per XML file. Child screens (scenario, input, outcome) are opened from the moment tab files.
- `_dev/data-export.csv` — question names and labels for a data export, in `Question;Format;Label` order.
- `_dev/Scoring Sheet/` — gauge impacts by option.
- `_dev/Content and Wireframe/` — source deck for scenario and outcome copy.
