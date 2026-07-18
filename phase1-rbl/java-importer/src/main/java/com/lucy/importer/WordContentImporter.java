package com.lucy.importer;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class WordContentImporter {
    private WordContentImporter() {
    }

    public static void main(String[] args) throws IOException {
        if (args.length != 1) {
            System.err.println("Usage: WordContentImporter <path-to-docx>");
            System.exit(1);
        }

        Path source = Path.of(args[0]);
        List<String> paragraphs = extractParagraphs(source);

        System.out.printf("Source: %s%n", source.toAbsolutePath());
        System.out.printf("Paragraphs extracted: %d%n", paragraphs.size());
        for (int i = 0; i < paragraphs.size(); i++) {
            System.out.printf("%03d | %s%n", i + 1, paragraphs.get(i));
        }
    }

    public static List<String> extractParagraphs(Path source) throws IOException {
        try (InputStream input = Files.newInputStream(source);
             XWPFDocument document = new XWPFDocument(input)) {
            List<String> paragraphs = new ArrayList<>();
            for (XWPFParagraph paragraph : document.getParagraphs()) {
                String text = paragraph.getText();
                if (text != null && !text.isBlank()) {
                    paragraphs.add(text.strip());
                }
            }
            return paragraphs;
        }
    }
}
