"""Create the two static font instances used only to outline repository artwork.

Run from any directory with:
  uv run --with fonttools==4.64.0 python scripts/assets/prepare-fonts.py
The checked-in inputs and their licenses come from the pinned Google Fonts
revision recorded in scripts/assets/provenance.json. This does not edit images.
"""

from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parent / "fonts"
instances = (
    ("Sora-variable.ttf", "Sora-SemiBold.ttf", {"wght": 600}),
    ("Inter-variable.ttf", "Inter-Regular.ttf", {"wght": 400, "opsz": 14}),
)

for source, target, axes in instances:
    font = TTFont(root / source, recalcTimestamp=False)
    instantiateVariableFont(font, axes, inplace=True)
    font.save(root / target, reorderTables=True)
    print(f"{target}: {axes}")
