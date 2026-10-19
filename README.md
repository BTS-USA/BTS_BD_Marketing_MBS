# BTS BD Marketing MBS

Wizer event for the Business Development Events AI Simulation (Dallas, Houston, Chicago, San Francisco). Participants work through a shared Indigo / Ember case and four moments. Three gauges sit on every screen: **AI Velocity**, **Team Trust**, and **Enterprise Value**. Each gauge starts at 50.

Screen text and question definitions live in `BTS_BD_Marketing_MBS.csv`. Screens are the XML files in `Actions`. Source deck and scoring sheet live under `_dev/Content and Wireframe/`.

## Room flow

The group director menu in `Actions/GD_Section_1.xml` runs in this order:

1. Welcome
2. Assign base values (writes 50 on all three gauges)
3. Team name (leader types the name; followers see a wait note)
4. Case context — Welcome to Indigo
5. Moment 1 — Prioritizing First Steps → aggregator → feedback
6. Moment 2 — When AI innovation creates uncertainty → aggregator → feedback
7. Moment 3 — When a Team Has a Breakthrough Worth Scaling (open brainstorm / word cloud)
8. Moment 4 — When Your Team Is Afraid of Being Replaced by AI → feedback (no scoring)
9. Verity bot — Practicing the Three Intelligences (leaders only; followers see a wait note)
10. Thank you

Only the team leader can submit on input screens. Followers either see locked controls (`Q.Leader==2`) or a dedicated wait note (Team Name and Verity).

The **Facilitator** tab opens results without moving the participant room: bar charts for Moments 1, 2, and 4, the Moment 3 word cloud, static leaderboard, and top 3 teams. The **Admin** tab is the reset screen.

## Moments and activities

| Moment | Event activity | What participants do |
| --- | --- | --- |
| 1 | Activity1 | Choose A–D |
| 2 | Activity2 | Choose A–C |
| 3 | Activity6 | Open text brainstorm; multiple entries allowed |
| 4 | Activity5 | Choose A–D |
| Verity | Bot1_AS_Verity | Leader chats with the bot; score written to `VerityScoreResult_HHSF6soY3vHUZULhWgVz` |

## Scoring

| Moment | Effect on the gauges |
| --- | --- |
| 1 | Updates AI Velocity, Team Trust, Enterprise Value |
| 2 | Updates AI Velocity, Team Trust, Enterprise Value |
| 3 | No gauge change. Shown as a list and a word cloud |
| 4 | No gauge change. Outcomes only |
| Verity | Separate **Verity Score** column on heatmap and leaderboards. Not folded into `Metric_Total` |

Moment scores are applied from the aggregator buttons on the group director menu (`Activity1_Aggregator`, `Activity2_Aggregator`). Each aggregator adds that moment’s deltas to the base 50 and to any earlier moment. `Metric_Total` = Metric1 + Metric2 + Metric3.

The numeric key is `_dev/Content and Wireframe/Allegis Simulation Framework_Scoring.xlsx` (rebuilt for this sim: Scores, Event fields, Flow).

A heatmap cell shows a tick when its question is `111` (base values, submitted brainstorm). Choice moments show A–D. Verity shows the numeric score.

## Files

- `BTS_BD_Marketing_MBS.csv` — questions, sections, and every `!{Key}` string.
- `Actions/` — one screen per XML file. Child screens (scenario, input, outcome) are opened from the moment tab files.
- `Actions/GD_Section_1.xml` — live room order.
- `Actions/Facilitator.xml` / `Actions/Reporting_Screen.xml` — results menus.
- `Actions/GD_Heatmap.xml` — Base Values, Moments 1–4, Verity Score.
- `_dev/data-export.csv` — question names and labels for a data export, in `Question;Format;Label` order.
- `_dev/Content and Wireframe/` — source deck and scoring sheet.
