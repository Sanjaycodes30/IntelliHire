package com.intellihire;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ResumeParserService {

    public String extractText(MultipartFile file) throws IOException {

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException(
                    "Please upload a PDF resume.");
        }

        String filename = file.getOriginalFilename();

        if (filename == null ||
                !filename.toLowerCase().endsWith(".pdf")) {

            throw new IllegalArgumentException(
                    "Only PDF files are supported.");
        }

        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException(
                    "Maximum PDF size is 5 MB.");
        }

        try (PDDocument document = Loader.loadPDF(file.getBytes())) {

            PDFTextStripper stripper = new PDFTextStripper();

            return stripper.getText(document);
        }
    }

    public String extractEmail(String text) {

        if (text == null || text.isBlank()) {
            return null;
        }

        Pattern pattern = Pattern.compile(
                "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");

        Matcher matcher = pattern.matcher(text);

        if (matcher.find()) {
            return matcher.group();
        }

        return null;
    }

    public String extractPhone(String text) {

        if (text == null || text.isBlank()) {
            return null;
        }

        Pattern pattern = Pattern.compile(
                "(?<!\\d)(?:\\+91[\\s-]?|91[\\s-]?)?[6-9]\\d{4}[\\s-]?\\d{5}(?!\\d)");

        Matcher matcher = pattern.matcher(text);

        if (matcher.find()) {
            return matcher.group().replaceAll("[\\s-]", "");
        }

        return null;
    }

    public String extractName(String text) {

        if (text == null || text.isBlank()) {
            return null;
        }

        String[] lines = text.split("\\R");

        int checkedLines = 0;

        for (String line : lines) {

            String candidate = line.trim();

            if (candidate.isEmpty()) {
                continue;
            }

            checkedLines++;

            if (checkedLines > 8) {
                break;
            }

            if (candidate.length() > 60) {
                continue;
            }

            if (candidate.matches(".*\\d.*")) {
                continue;
            }

            if (candidate.contains("@")
                    || candidate.contains("http")
                    || candidate.contains("www.")) {
                continue;
            }

            if (candidate.matches(
                    "(?i).*(resume|curriculum vitae|profile|summary|objective|experience|education|skills|contact|developer|engineer|analyst|linkedin|github).*")) {
                continue;
            }

            if (candidate.matches(
                    "[A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*){1,3}")) {
                return candidate;
            }
        }

        return null;
    }
}