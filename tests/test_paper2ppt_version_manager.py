import importlib.util
from pathlib import Path


def _load_version_manager():
    module_path = Path(__file__).resolve().parents[1] / "dataflow_agent" / "utils" / "version_manager.py"
    spec = importlib.util.spec_from_file_location("version_manager_under_test", module_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.ImageVersionManager


ImageVersionManager = _load_version_manager()


def _write_png(path: Path, payload: bytes) -> None:
    path.write_bytes(payload)


def test_save_versioned_image_tracks_current_version(tmp_path: Path) -> None:
    img_dir = tmp_path / "ppt_pages"
    img_dir.mkdir()

    current = img_dir / "page_000.png"
    _write_png(current, b"initial-slide")

    edited = tmp_path / "edited.png"
    _write_png(edited, b"edited-slide")

    versioned_path, version_num = ImageVersionManager.save_versioned_image(
        img_dir=img_dir,
        page_idx=0,
        new_image_path=str(edited),
        prompt="tighten layout",
    )

    assert version_num == 2
    assert Path(versioned_path).exists()
    assert ImageVersionManager.get_current_version(img_dir, 0) == 2

    history = ImageVersionManager.get_version_history(img_dir, 0)
    assert [item["version"] for item in history] == [1, 2]
    assert history[-1]["is_current_version"] is True


def test_revert_to_version_updates_current_pointer(tmp_path: Path) -> None:
    img_dir = tmp_path / "ppt_pages"
    img_dir.mkdir()

    current = img_dir / "page_001.png"
    _write_png(current, b"v1")

    edited_a = tmp_path / "edited_a.png"
    edited_b = tmp_path / "edited_b.png"
    _write_png(edited_a, b"v2")
    _write_png(edited_b, b"v3")

    ImageVersionManager.save_versioned_image(img_dir, 1, str(edited_a), "pass a")
    ImageVersionManager.save_versioned_image(img_dir, 1, str(edited_b), "pass b")

    reverted = ImageVersionManager.revert_to_version(img_dir, 1, 2)

    assert reverted is not None
    assert ImageVersionManager.get_current_version(img_dir, 1) == 2
    assert (img_dir / "page_001.png").read_bytes() == b"v2"
