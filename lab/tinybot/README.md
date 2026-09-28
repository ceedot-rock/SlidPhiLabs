# tinybot (lab)

3x3 self-building frame. Not ExactOdds MCP.

```bash
mkdir -p ~/tinybot && cd ~/tinybot
curl -fsSL -o tinybot_edged_3x3.py https://raw.githubusercontent.com/ceedot-rock/SlidPhiLabs/main/lab/tinybot/tinybot_edged_3x3.py
curl -fsSL -o lessons.tsv https://raw.githubusercontent.com/ceedot-rock/SlidPhiLabs/main/lab/tinybot/lessons.tsv
curl -fsSL -o thesaurus.tsv https://raw.githubusercontent.com/ceedot-rock/SlidPhiLabs/main/lab/tinybot/thesaurus.tsv
export TINYBOT_DNA='your-private-seed'
export TINYBOT_MASTER='upgrade alpha'
python3 tinybot_edged_3x3.py --tudor --lessons lessons.tsv
```
