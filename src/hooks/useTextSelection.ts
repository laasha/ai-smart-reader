import { useState, useEffect, useCallback } from 'react';

export const useTextSelection = () => {
    const [selection, setSelection] = useState<{ text: string; context: string; rect: DOMRect | null } | null>(null);

    const handleSelectionChange = useCallback(() => {
        setTimeout(() => {
            const selectedText = window.getSelection();
            if (selectedText && selectedText.toString().trim().length > 0) {
                const range = selectedText.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const contextNode = range.commonAncestorContainer;
                const contextText = contextNode.textContent || selectedText.toString();
                setSelection({
                    text: selectedText.toString().trim(),
                    context: contextText.trim(),
                    rect
                });
            } else {
                setSelection(null);
            }
        }, 10);
    }, []);

    useEffect(() => {
        document.addEventListener('mouseup', handleSelectionChange);
        document.addEventListener('touchend', handleSelectionChange);
        document.addEventListener('keyup', handleSelectionChange);
        return () => {
            document.removeEventListener('mouseup', handleSelectionChange);
            document.removeEventListener('touchend', handleSelectionChange);
            document.removeEventListener('keyup', handleSelectionChange);
        };
    }, [handleSelectionChange]);

    return { selection, setSelection };
};
