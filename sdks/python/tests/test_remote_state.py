import pytest

from lingva._remote_state import LingvaMergeConflictError, merge_remote_dictionary


def test_three_way_merge_keeps_independent_local_and_remote_changes():
    assert merge_remote_dictionary(
        "en",
        {"title": "Old", "body": "Old body"},
        {"title": "Local", "body": "Old body"},
        {"title": "Old", "body": "Remote body"},
    ) == {"body": "Remote body", "title": "Local"}


def test_three_way_merge_rejects_same_key_changes_without_overwriting_local_value():
    with pytest.raises(LingvaMergeConflictError, match="title"):
        merge_remote_dictionary(
            "en",
            {"title": "Old"},
            {"title": "Local"},
            {"title": "Remote"},
        )


def test_three_way_merge_treats_variant_collection_as_one_conflict_unit():
    base = {"title": [{"id": "warm", "text": "Old"}]}
    with pytest.raises(LingvaMergeConflictError, match="title"):
        merge_remote_dictionary(
            "en",
            base,
            {"title": [{"id": "warm", "text": "Local"}]},
            {"title": [{"id": "warm", "text": "Remote"}]},
        )
