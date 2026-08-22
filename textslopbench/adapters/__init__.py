"""Local, no-download adapters for TextSlopBench source datasets."""

from .baumler import BaumlerAdapter
from .beemo import BeemoAdapter
from .lamp import LAMPAdapter
from .tetra import TETRAAdapter
from .wq import WQAdapter

ADAPTERS = {
    "lamp": LAMPAdapter,
    "baumler": BaumlerAdapter,
    "beemo": BeemoAdapter,
    "tetra": TETRAAdapter,  # scaffold: pending dataset
    "wq": WQAdapter,
}

__all__ = ["ADAPTERS", "LAMPAdapter", "BaumlerAdapter", "BeemoAdapter", "TETRAAdapter", "WQAdapter"]
