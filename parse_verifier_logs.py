
import re
import json
import sys

def parse_log_file_content(file_path, content):
    log_data = {
        "Ticket ID": None,
        "PRD Key": None,
        "Title": None,
        "Outcome": None,
        "Logged At": None,
        "Summary": None,
        "Reject Reason": None,
        "Ticket Path": None,
    }

    # Extract from Meta section
    meta_section_match = re.search(r'''## Meta

([\s\S]*?)(?=
##|$)''', content)
    if meta_section_match:
        meta_content = meta_section_match.group(1)
        
        ticket_id_match = re.search(r'Ticket ID: (\d+)', meta_content)
        if ticket_id_match:
            log_data["Ticket ID"] = ticket_id_match.group(1)

        prd_key_match = re.search(r'PRD Key: (prd_\d+)', meta_content)
        if prd_key_match:
            log_data["PRD Key"] = prd_key_match.group(1)

        title_match = re.search(r'Title: (.*)', meta_content)
        if title_match:
            log_data["Title"] = title_match.group(1).strip()

        outcome_match = re.search(r'Outcome: (pass|fail|pending|rejected)', meta_content)
        if outcome_match:
            log_data["Outcome"] = outcome_match.group(1)

        logged_at_match = re.search(r'Logged At: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)', meta_content)
        if logged_at_match:
            log_data["Logged At"] = logged_at_match.group(1)

        ticket_path_match = re.search(r'Ticket Path: `?([^`]+)`?', meta_content)
        if ticket_path_match:
            log_data["Ticket Path"] = ticket_path_match.group(1).strip()

    # Extract initial Summary
    summary_match = re.search(r'''## Summary

- Result Summary: (.*)''', content)
    if summary_match:
        initial_summary = summary_match.group(1).strip()
        if initial_summary and initial_summary.lower() != 'pending':
            log_data["Summary"] = initial_summary

    # Extract Reject Reason for fail/rejected outcomes
    if log_data["Outcome"] in ['fail', 'rejected']:
        reject_reason_match = re.search(r'''## Reject Reason

([\s\S]*?)(?=
##|$)''', content)
        if reject_reason_match:
            # Strip any leading/trailing whitespace and remove trailing backticks if present
            log_data["Reject Reason"] = reject_reason_match.group(1).strip().replace('`', '')


    # If initial summary is pending or empty, try to get from the final Result section
    if not log_data["Summary"]:
        final_result_section_match = re.search(r'''## Result

([\s\S]*?)(?=
##|$)''', content)
        if final_result_section_match:
            final_result_content = final_result_section_match.group(1)
            
            verdict_match = re.search(r'Verdict: (.*)', final_result_content)
            summary_from_result_match = re.search(r'Summary: (.*)', final_result_content)

            combined_summary_parts = []
            if verdict_match and verdict_match.group(1).strip():
                combined_summary_parts.append(f"Verdict: {verdict_match.group(1).strip()}")
            if summary_from_result_match and summary_from_result_match.group(1).strip():
                combined_summary_parts.append(f"Summary: {summary_from_result_match.group(1).strip()}")

            if combined_summary_parts:
                log_data["Summary"] = " - ".join(combined_summary_parts)
            

    return log_data

# List of file paths provided by the user
file_paths = [
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_161_20260503_141528Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_160_20260503_135928Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_158_20260503_135038Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_156_20260503_132543Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_159_20260503_131551Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_155_20260503_130448Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_154_20260503_124916Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_153_20260503_124340Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_152_20260503_123510Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_151_20260503_122726Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_148_20260503_122232Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_150_20260503_121503Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_149_20260503_120833Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_147_20260503_120105Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_146_20260503_115517Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_145_20260503_114714Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_144_20260503_114209Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_143_20260503_113538Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_142_20260503_112718Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_141_20260503_111002Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_140_20260503_110255Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_139_20260503_105540Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_138_20260503_104539Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_137_20260503_103359Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_136_20260503_102706Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_135_20260503_101045Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_134_20260503_095803Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_133_20260503_094702Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_132_20260503_094119Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_131_20260503_092857Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_130_20260503_091619Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_129_20260503_085313Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_128_20260503_084707Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_127_20260503_084238Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_126_20260503_083800Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_125_20260503_083350Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_124_20260503_082330Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_123_20260503_081819Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_122_20260503_075404Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_121_20260503_074633Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_121_20260503_073415Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_121_20260503_072034Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_120_20260503_070314Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_119_20260503_064242Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_119_20260503_063814Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_119_20260503_063459Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_119_20260503_062650Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_118_20260503_060438Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_117_20260503_011935Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_116_20260503_011044Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_003_20260429_223915Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_003_20260429_224735Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_003_20260430_055917Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_003_20260430_110852Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_003_20260430_224033Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_003_20260430_225631Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_003_20260430_232446Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_003_20260430_233049Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_003_20260430_233254Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_003_20260430_234056Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_003_20260501_173500Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_049_20260429_070935Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_049_20260429_071438Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_049_20260429_071806Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_049_20260429_072155Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_049_20260429_072529Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_049_20260429_072945Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_049_20260429_073447Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_049_20260429_073848Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_049_20260429_074221Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_064_20260430_233840Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_066_20260430_234120Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_066_20260501_001625Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_067_20260430_234738Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_070_20260501_002856Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_071_20260501_003802Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_071_20260501_112658Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_071_20260501_113121Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_071_20260501_113626Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_071_20260501_114211Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_071_20260501_115258Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_071_20260501_131209Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_071_20260501_131609Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_071_20260501_132029Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_072_20260501_004618Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_073_20260501_132623Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_074_20260501_134047Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_074_20260501_135037Z_fail.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_075_20260501_134544Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_076_20260501_210711Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_078_20260501_210908Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_079_20260501_211133Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_080_20260501_211348Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_081_20260501_211600Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_082_20260501_211829Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_083_20260501_212105Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_084_20260501_212358Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_085_20260501_212632Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_086_20260501_213207Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_087_20260501_221933Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_088_20260501_222130Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_089_20260501_222402Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_090_20260501_222726Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_091_20260501_223253Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_092_20260502_002615Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_093_20260502_003003Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_094_20260502_003324Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_095_20260502_003804Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_096_20260502_014849Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_097_20260502_020007Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_098_20260502_020430Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_099_20260502_020942Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_100_20260502_022615Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_101_20260502_023241Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_103_20260502_025107Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_104_20260502_055437Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_105_20260502_060107Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_106_20260502_060836Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_107_20260502_063324Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_108_20260502_063629Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_109_20260502_063902Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_110_20260502_064134Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_111_20260502_064439Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_112_20260502_064758Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_113_20260502_065015Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_114_20260502_231831Z_pass.md",
"/Users/demoon2016/Documents/project/autoflow/.autoflow/logs/verifier_115_20260502_232210Z_pass.md"
]

parsed_results = []
for file_path in file_paths:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        parsed_results.append(parse_log_file_content(file_path, content))
    except Exception as e:
        # For error handling, print the error to stderr and continue
        print(f"Error parsing {file_path}: {e}", file=sys.stderr)
        parsed_results.append({"File Path": file_path, "Error": str(e)})

print(json.dumps(parsed_results, indent=2))
