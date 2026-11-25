from app.sync import manager


def test_wrong_or_missing_token_gets_nothing_and_keeps_entry():
    manager.register_download_token(9001, "right-token")
    manager.store_raw_response(9001, '{"accounts": []}')

    assert manager.get_raw_response(9001, "wrong-token") is None
    assert manager.get_raw_response(9001, "") is None
    assert manager.get_raw_response(9001, "right-token") == '{"accounts": []}'


def test_download_is_one_time():
    manager.register_download_token(9002, "t")
    manager.store_raw_response(9002, "data")

    assert manager.get_raw_response(9002, "t") == "data"
    assert manager.get_raw_response(9002, "t") is None


def test_capture_without_token_is_never_downloadable():
    manager.store_raw_response(9003, "data")

    assert manager.get_raw_response(9003, "") is None
    assert manager.get_raw_response(9003, "anything") is None
