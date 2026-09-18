"""Universal Candidate-Job Matching and Scoring Engine.

Designed to be profession-agnostic: evaluates fit across software, data,
design, product, finance, marketing, operations, healthcare, and other professions.
"""

# Universal role indicators across career categories
PROFESSIONAL_ROLE_KEYWORDS = {
    # Engineering & Tech
    "software", "engineer", "developer", "backend", "frontend", "fullstack",
    "full stack", "devops", "sre", "infrastructure", "platform", "cloud",
    # Data & AI
    "data", "analyst", "scientist", "machine learning", "ai", "deep learning",
    "bi", "analytics", "statistician", "data engineer", "mlops", "nlp",
    # Product & Design
    "product", "product manager", "designer", "ux", "ui", "researcher",
    "product design", "design system", "product ops",
    # Business & Operations
    "operations", "bizops", "strategy", "consultant", "supply chain", "logistics",
    "procurement", "business analyst", "project manager", "program manager",
    # Marketing & Sales
    "marketing", "growth", "seo", "content", "sales", "account executive",
    "business development", "sdr", "sales engineer",
    # Finance, People & Legal
    "finance", "financial", "fp&a", "accountant", "recruiter", "talent",
    "hr", "people ops", "legal", "counsel", "compliance",
    # Healthcare & Science
    "healthcare", "clinical", "research", "scientist", "laboratory",
}

SENIORITY_KEYWORDS = {
    "intern": 10,
    "new grad": 15,
    "junior": 20,
    "associate": 25,
    "mid": 30,
    "senior": 40,
    "lead": 45,
    "staff": 50,
    "principal": 55,
    "manager": 45,
    "director": 50,
    "head": 55,
    "vp": 60,
}


def calculate_match_score(title: str, description: str = "") -> int:
    """Calculate a baseline role relevance score (0-100) based on title clarity and description depth.

    Future iterations will compare against the authenticated candidate's CareerProfile skills and experience.
    """
    if not title or not title.strip():
        return 0

    title_lower = title.lower()
    desc_lower = (description or "").lower()
    full_text = f"{title_lower} {desc_lower}"
    score = 30  # Baseline confidence for a valid job posting

    # Match professional role domain keywords in title
    matched_role_kws = sum(1 for kw in PROFESSIONAL_ROLE_KEYWORDS if kw in title_lower)
    score += min(matched_role_kws * 15, 30)

    # Detect clear seniority / career level specification
    has_seniority = any(lvl in title_lower for lvl in SENIORITY_KEYWORDS)
    if has_seniority:
        score += 15

    # Description quality and requirements completeness
    desc_words = len(desc_lower.split())
    if desc_words > 150:
        score += 15
    elif desc_words > 50:
        score += 10

    # Mentions responsibilities / requirements sections
    if any(section in desc_lower for section in ("requirements", "responsibilities", "qualifications", "what you'll do", "what you need")):
        score += 10

    return min(max(score, 20), 100)
