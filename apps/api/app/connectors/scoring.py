HIGH_PRIORITY_KEYWORDS = [
    "mlops",
    "ml infrastructure",
    "ai infrastructure",
    "ml platform",
    "ai platform",
    "machine learning infrastructure",
    "machine learning engineer",
    "ml engineer",
    "ai engineer",
    "research scientist",
    "research engineer",
    "applied scientist",
    "applied ai engineer",
]
HARDWARE_INFRA_KEYWORDS = [
    "kernel",
    "gpu",
    "tpu",
    "compiler",
    "distributed training",
    "inference optimization",
    "cluster",
    "cuda",
]
MEDIUM_PRIORITY_KEYWORDS = [
    "site reliability",
    "sre",
    "platform engineer",
    "infrastructure engineer",
]
LOW_PRIORITY_KEYWORDS = [
    "ai agent",
    "agent engineer",
    "llm",
    "prompt engineering",
]
AI_ML_CONTEXT_KEYWORDS = [
    "ai",
    "ml",
    "machine learning",
    "model",
    "llm",
    "inference",
    "gpu",
]
BASE_KEYWORDS = ["software engineer", "backend engineer", "platform"]

EXCLUDE_TITLE_PATTERNS = [
    "account executive",
    "recruiter",
    "economist",
    "counsel",
    "paralegal",
    "warehouse",
    "applied ai architect",
    "program manager",
    "director",
]
ENGINEERING_MANAGER_ALLOW = [
    "engineering manager",
    "infrastructure manager",
    "platform manager",
    "sre manager",
    "site reliability manager",
]


def is_non_engineering_title(title_lower: str) -> bool:
    if any(allow in title_lower for allow in ENGINEERING_MANAGER_ALLOW):
        return False
    if "manager" in title_lower:
        return True
    return any(p in title_lower for p in EXCLUDE_TITLE_PATTERNS)


def calculate_match_score(title: str, description: str) -> int:
    text = f"{title} {description}".lower()
    title_lower = title.lower()
    score = 0

    if is_non_engineering_title(title_lower):
        return min(score, 15)

    for kw in HIGH_PRIORITY_KEYWORDS + HARDWARE_INFRA_KEYWORDS:
        if kw in text:
            score += 40
            break

    for kw in MEDIUM_PRIORITY_KEYWORDS:
        if kw in text:
            has_ai_context = any(ctx in text for ctx in AI_ML_CONTEXT_KEYWORDS)
            score += 30 if has_ai_context else 15
            break

    for kw in LOW_PRIORITY_KEYWORDS:
        if kw in text:
            score += 20
            break

    for kw in BASE_KEYWORDS:
        if kw in text:
            score += 10
            break

    return min(score, 100)
