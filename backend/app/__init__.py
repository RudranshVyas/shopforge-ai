# On Windows, torch must load its DLLs before pyarrow loads its own, otherwise
# importing torch afterwards fails with "WinError 1114: DLL initialization routine
# failed". Every entry point goes through this package, so the ordering is fixed here.
try:
    import torch  # noqa: F401
except ImportError:
    pass
