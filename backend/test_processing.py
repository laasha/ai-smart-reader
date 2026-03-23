from processing import clean_text

def test_clean_text():
    raw_text = "This   is \n\n a    test."
    cleaned = clean_text(raw_text)
    assert cleaned == "This is a test."

def test_clean_text_empty():
    assert clean_text("") == ""
    assert clean_text("   \n\t  ") == ""
