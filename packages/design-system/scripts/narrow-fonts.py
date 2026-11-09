"""Limits the weight axis of a variable font (E08). Needs: pip install fonttools brotli
Usage: python narrow-fonts.py <input.woff2> <output.woff2> <min-weight> <max-weight>"""
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

source, target, low, high = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
font = instancer.instantiateVariableFont(TTFont(source), {"wght": (low, high)})
font.flavor = "woff2"
font.save(target)
