#!/usr/bin/env python3
"""Digitize LUCY Word learning documents into JSON and MySQL/MariaDB SQL.

This script is intentionally dependency-free. It reads .docx files directly as
OpenXML zip archives, extracts paragraphs, groups them into lessons, and emits
importable seed files for the phase 1 database schema.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import asdict, dataclass
from collections.abc import Sequence
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import subprocess


WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


@dataclass(frozen=True)
class SourceSpec:
    file_name: str
    language_code: str
    language_name: str
    stage_number: int
    level_start: int
    level_end: int
    include: bool = True
    note: str = ""


@dataclass
class ContentBlock:
    sort_order: int
    block_type: str
    text: str
    raw_paragraph_index: int


@dataclass
class Lesson:
    language_code: str
    stage_number: int
    level_number: int
    title: str
    source_file: str
    content_blocks: list[ContentBlock]


SOURCES = [
    SourceSpec("Chinese - level 1-30.docx", "zh", "Chinese", 1, 1, 30),
    SourceSpec("Chinese - level 31-60.docx", "zh", "Chinese", 2, 31, 60),
    SourceSpec("chinese level 61-100.docx", "zh", "Chinese", 3, 61, 100),
    SourceSpec("Eng - STAGE 1 (LEVELS 1-30).docx", "en", "English", 1, 1, 30),
    SourceSpec(
        "Eng - STAGE 2 (LEVEL 31-60) REVIEWED_SID.docx",
        "en",
        "English",
        2,
        31,
        60,
        True,
        "Reviewed English stage 2 version selected as canonical import source.",
    ),
    SourceSpec(
        "Eng - STAGE 2 (LEVEL 31-60).docx",
        "en",
        "English",
        2,
        31,
        60,
        False,
        "Skipped because REVIEWED_SID is treated as the canonical reviewed version.",
    ),
    SourceSpec("Eng - STAGE 3 (LEVELS 61-100).pdf", "en", "English", 3, 61, 100),
    SourceSpec("Janpanes - ステージ1(レベル1-30).docx", "ja", "Japanese", 1, 1, 30),
    SourceSpec("Janpanes - ステージ2(レベル31-60).docx", "ja", "Japanese", 2, 31, 60),
    SourceSpec("Janpanes - ステージ3(レベル61-100).docx", "ja", "Japanese", 3, 61, 100),
]


def extract_docx_paragraphs(path: Path) -> list[str]:
    with ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))

    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", WORD_NAMESPACE):
        text = "".join(t.text or "" for t in paragraph.findall(".//w:t", WORD_NAMESPACE)).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def extract_pdf_paragraphs(path: Path) -> list[str]:
    result = subprocess.run(
        ["pdftotext", str(path), "-"],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def extract_paragraphs(path: Path) -> list[str]:
    if path.suffix.lower() == ".pdf":
        return extract_pdf_paragraphs(path)
    return extract_docx_paragraphs(path)


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def strip_heading_marker(text: str) -> str:
    return text.lstrip("📘🔵🔷🔴🔹🏆🎯⏱️✅✔ ").strip()


def parse_japanese_range_heading(text: str) -> tuple[int, int, str] | None:
    normalized = strip_heading_marker(text)
    if not normalized.startswith("レベル"):
        return None

    match = re.match(r"^レベル\s*(\d{1,3})\s*[–-]\s*(\d{1,3})\s*[：:）)]?\s*(.*?)\s*$", normalized)
    if not match:
        return None

    start, end = int(match.group(1)), int(match.group(2))
    title = match.group(3).strip("：:（）() ") or f"Levels {start}-{end}"
    return start, end, title


def parse_numbered_heading(text: str) -> tuple[int, str] | None:
    match = re.match(r"^\s*(\d{1,3})\s*[\.)．、]\s*(.+?)\s*$", text)
    if match:
        return int(match.group(1)), match.group(2).strip()

    match = re.search(r"LEVEL\s+(\d{1,3})\s*[–\-:：]\s*([^🔵🔷]+)", text, re.IGNORECASE)
    if match:
        return int(match.group(1)), match.group(2).strip()

    normalized = strip_heading_marker(text)
    match = re.match(r"^レベル\s*(\d{1,3})\s*[–\-:：、．。)]\s*(.+?)\s*$", normalized, re.IGNORECASE)
    if match and not re.match(r"^\d{1,3}\s*[:：）)]", match.group(2).strip()):
        return int(match.group(1)), match.group(2).strip("：:（）() ")

    return None


def block_type(text: str) -> str:
    if re.match(r"^Q\d+\s*[:：]", text, re.IGNORECASE):
        return "question"
    if text.startswith("👉") or text.startswith("→"):
        return "answer"
    if re.search(r"sub-?level|warm-up|mission|task|prompt", text, re.IGNORECASE):
        return "instruction"
    return "paragraph"


def append_block(lesson: Lesson, paragraph: str, raw_paragraph_index: int) -> None:
    lesson.content_blocks.append(
        ContentBlock(
            sort_order=len(lesson.content_blocks) + 1,
            block_type=block_type(paragraph),
            text=paragraph,
            raw_paragraph_index=raw_paragraph_index,
        )
    )


def expand_japanese_range_lessons(
    spec: SourceSpec,
    start: int,
    end: int,
    group_title: str,
    theme_lines: Sequence[tuple[int, str]],
) -> list[Lesson]:
    lessons: list[Lesson] = []
    for offset, level_number in enumerate(range(start, end + 1)):
        title = theme_lines[offset][1] if offset < len(theme_lines) else f"{group_title} {level_number}"
        raw_index = theme_lines[offset][0] if offset < len(theme_lines) else 0
        lesson = Lesson(spec.language_code, spec.stage_number, level_number, title, spec.file_name, [])
        append_block(lesson, f"Japanese stage topic group: {group_title}", raw_index)
        lessons.append(lesson)
    return lessons


def build_japanese_lessons(spec: SourceSpec, paragraphs: list[str]) -> list[Lesson]:
    lessons: list[Lesson] = []
    index = 0
    while index < len(paragraphs):
        paragraph = paragraphs[index]
        range_heading = parse_japanese_range_heading(paragraph)
        if range_heading is None:
            heading = parse_numbered_heading(paragraph)
            if heading and spec.level_start <= heading[0] <= spec.level_end:
                level_number, title = heading
                lesson = Lesson(spec.language_code, spec.stage_number, level_number, title, spec.file_name, [])
                index += 1
                while index < len(paragraphs):
                    next_paragraph = paragraphs[index]
                    if parse_numbered_heading(next_paragraph) or parse_japanese_range_heading(next_paragraph):
                        break
                    append_block(lesson, next_paragraph, index + 1)
                    index += 1
                lessons.append(lesson)
                continue
            index += 1
            continue

        start, end, group_title = range_heading
        if not (spec.level_start <= start <= spec.level_end):
            index += 1
            continue

        theme_lines: list[tuple[int, str]] = []
        index += 1
        expand_end = min(end, spec.level_end)
        while index < len(paragraphs):
            next_paragraph = paragraphs[index]
            if parse_japanese_range_heading(next_paragraph):
                break
            next_heading = parse_numbered_heading(next_paragraph)
            if next_heading:
                next_level, _ = next_heading
                if start <= next_level <= end:
                    expand_end = next_level - 1
                break
            if next_paragraph not in {"主要テーマ：", "主なテーマ："}:
                theme_lines.append((index + 1, next_paragraph))
            index += 1

        if expand_end >= start:
            lessons.extend(expand_japanese_range_lessons(spec, start, expand_end, group_title, theme_lines))

    return lessons


def build_lessons(spec: SourceSpec, paragraphs: list[str]) -> list[Lesson]:
    if spec.language_code == "ja":
        return build_japanese_lessons(spec, paragraphs)

    lessons: list[Lesson] = []
    current: Lesson | None = None
    fallback_level = spec.level_start

    for index, paragraph in enumerate(paragraphs, start=1):
        heading = parse_numbered_heading(paragraph)
        if heading and spec.level_start <= heading[0] <= spec.level_end:
            level_number, title = heading
            if current and current.level_number == level_number and current.title.startswith("Document introduction - "):
                current.title = title
                continue
            current = Lesson(spec.language_code, spec.stage_number, level_number, title, spec.file_name, [])
            lessons.append(current)
            continue

        if current is None:
            title = f"Document introduction - {spec.file_name}"
            current = Lesson(spec.language_code, spec.stage_number, fallback_level, title, spec.file_name, [])
            lessons.append(current)

        append_block(current, paragraph, index)

    return lessons


def sql_quote(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def emit_sql(specs: Iterable[SourceSpec], lessons: list[Lesson], checksums: dict[str, str]) -> str:
    included_specs = [spec for spec in specs if spec.include]
    lines: list[str] = [
        "SET NAMES utf8mb4;",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "DELETE FROM content_blocks;",
        "DELETE FROM lessons;",
        "DELETE FROM levels;",
        "DELETE FROM stages;",
        "DELETE FROM source_documents;",
        "SET FOREIGN_KEY_CHECKS = 1;",
        "",
    ]

    for spec in included_specs:
        lines.append(
            "INSERT INTO source_documents (file_name, language_code, checksum, status) VALUES "
            f"({sql_quote(spec.file_name)}, {sql_quote(spec.language_code)}, {sql_quote(checksums[spec.file_name])}, 'IMPORTED') "
            "ON DUPLICATE KEY UPDATE status = VALUES(status);"
        )

    for spec in included_specs:
        title = f"Stage {spec.stage_number} / Levels {spec.level_start}-{spec.level_end}"
        lines.append(
            "INSERT INTO stages (language_id, stage_number, title) "
            f"SELECT id, {spec.stage_number}, {sql_quote(title)} FROM languages WHERE code = {sql_quote(spec.language_code)} "
            "ON DUPLICATE KEY UPDATE title = VALUES(title);"
        )

    for lesson in lessons:
        lines.append(
            "INSERT INTO levels (stage_id, level_number, title) "
            "SELECT s.id, "
            f"{lesson.level_number}, {sql_quote('Level ' + str(lesson.level_number))} "
            "FROM stages s JOIN languages l ON l.id = s.language_id "
            f"WHERE l.code = {sql_quote(lesson.language_code)} AND s.stage_number = {lesson.stage_number} "
            "ON DUPLICATE KEY UPDATE title = VALUES(title);"
        )
        lines.append(
            "INSERT INTO lessons (level_id, sequence_number, title) "
            "SELECT lv.id, 1, "
            f"{sql_quote(lesson.title)} "
            "FROM levels lv JOIN stages s ON s.id = lv.stage_id JOIN languages l ON l.id = s.language_id "
            f"WHERE l.code = {sql_quote(lesson.language_code)} AND s.stage_number = {lesson.stage_number} "
            f"AND lv.level_number = {lesson.level_number} "
            "ON DUPLICATE KEY UPDATE title = VALUES(title);"
        )
        for block in lesson.content_blocks:
            lines.append(
                "INSERT INTO content_blocks (lesson_id, block_type, content_text, sort_order) "
                "SELECT le.id, "
                f"{sql_quote(block.block_type)}, {sql_quote(block.text)}, {block.sort_order} "
                "FROM lessons le JOIN levels lv ON lv.id = le.level_id "
                "JOIN stages s ON s.id = lv.stage_id JOIN languages l ON l.id = s.language_id "
                f"WHERE l.code = {sql_quote(lesson.language_code)} AND s.stage_number = {lesson.stage_number} "
                f"AND lv.level_number = {lesson.level_number} AND le.sequence_number = 1 "
                "ON DUPLICATE KEY UPDATE block_type = VALUES(block_type), content_text = VALUES(content_text);"
            )

    lines.append("")
    return "\n".join(lines)


def emit_summary(specs: list[SourceSpec], lessons: list[Lesson], paragraphs_by_file: dict[str, int]) -> dict[str, object]:
    by_language: dict[str, dict[str, int]] = {}
    for lesson in lessons:
        stats = by_language.setdefault(lesson.language_code, {"lessons": 0, "content_blocks": 0})
        stats["lessons"] += 1
        stats["content_blocks"] += len(lesson.content_blocks)

    return {
        "source_files": [asdict(spec) for spec in specs],
        "included_files": [spec.file_name for spec in specs if spec.include],
        "skipped_files": [asdict(spec) for spec in specs if not spec.include],
        "paragraphs_by_file": paragraphs_by_file,
        "total_lessons": len(lessons),
        "total_content_blocks": sum(len(lesson.content_blocks) for lesson in lessons),
        "by_language": by_language,
    }


def merge_duplicate_lessons(lessons: list[Lesson]) -> list[Lesson]:
    merged: dict[tuple[str, int, int], Lesson] = {}
    for lesson in lessons:
        key = (lesson.language_code, lesson.stage_number, lesson.level_number)
        existing = merged.get(key)
        if existing is None:
            merged[key] = lesson
            continue
        for block in lesson.content_blocks:
            existing.content_blocks.append(
                ContentBlock(
                    sort_order=len(existing.content_blocks) + 1,
                    block_type=block.block_type,
                    text=block.text,
                    raw_paragraph_index=block.raw_paragraph_index,
                )
            )
    return sorted(merged.values(), key=lambda item: (item.language_code, item.stage_number, item.level_number))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="Repository root containing Word files")
    parser.add_argument("--out", type=Path, default=Path("phase1-rbl/generated"), help="Output directory")
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    lessons: list[Lesson] = []
    paragraphs_by_file: dict[str, int] = {}
    checksums: dict[str, str] = {}

    for spec in SOURCES:
        path = args.root / spec.file_name
        if not path.exists():
            raise FileNotFoundError(path)
        paragraphs = extract_paragraphs(path)
        paragraphs_by_file[spec.file_name] = len(paragraphs)
        checksums[spec.file_name] = checksum(path)
        if spec.include:
            lessons.extend(build_lessons(spec, paragraphs))

    lessons = merge_duplicate_lessons(lessons)

    json_payload = {
        "lessons": [
            {
                "language_code": lesson.language_code,
                "stage_number": lesson.stage_number,
                "level_number": lesson.level_number,
                "title": lesson.title,
                "source_file": lesson.source_file,
                "content_blocks": [asdict(block) for block in lesson.content_blocks],
            }
            for lesson in lessons
        ]
    }

    (args.out / "digitized-content.json").write_text(json.dumps(json_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.out / "digitized-content.sql").write_text(emit_sql(SOURCES, lessons, checksums), encoding="utf-8")
    (args.out / "digitization-summary.json").write_text(
        json.dumps(emit_summary(SOURCES, lessons, paragraphs_by_file), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Lessons: {len(lessons)}")
    print(f"Content blocks: {sum(len(lesson.content_blocks) for lesson in lessons)}")
    print(f"Output: {args.out}")


if __name__ == "__main__":
    main()
