# Domain Model: Career Directions

> **Status:** Planned — Phase 4 dependency  
> **Owner:** CareerNeed Domain & Product Architecture  
> **Last Updated:** 2026-09-19  
> **Scope:** Career Direction entity definition, data relationships, lifecycle, multi-direction management, and downstream system consumers.

---

## 1. Domain Concept: "What I Want to Pursue"

A **Career Direction** is a durable, candidate-owned strategic planning entity. It encapsulates a candidate's specific job-search intent and criteria for a distinct career path:

```text
       Candidate Profile ("What I can do" - Durable History)
              │
              ├──► Career Direction A ("Backend Infrastructure SWE")
              │          │
              │          ├── Informs Resume Version 1 (Tailored for Systems)
              │          ├── Informs Match Result (Weights distributed systems)
              │          └── Informs Opportunity Watch A (Alerts for Backend)
              │
              └──► Career Direction B ("Applied AI / LLM Engineer")
                         │
                         ├── Informs Resume Version 2 (Tailored for ML/AI)
                         ├── Informs Match Result (Weights PyTorch, CUDA, RAG)
                         └── Informs Opportunity Watch B (Alerts for AI)
```

### Core Invariant: Clear Domain Separation
- A candidate has **one** Candidate Profile (their cumulative skills and history).
- A candidate may maintain **one or more** Career Directions (e.g. Senior Backend Engineer vs Engineering Manager vs Data Engineer).
- **Not Merged with Watch**: Career Direction is **NOT** a notification or watch rule. It is a durable strategic domain object that exists even if all notifications and alerts are disabled. Opportunity Watch is a consumer of Career Direction, not its owner.

---

## 2. Downstream System Consumers

Career Direction acts as the strategic nexus across multiple core systems:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SYSTEMS INFORMED BY CAREER DIRECTION                     │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ 1. Resume Version   │ Binds default and tailored Resume Versions to this    │
│    Targeting        │ specific direction for fast application workflows.    │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 2. Match Result     │ Provides target roles, seniority bands, and skills    │
│    Evaluation       │ weights to the contextual matching engine.            │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 3. Opportunity      │ Provides filtering constraints (roles, locations,     │
│    Watch Alerts     │ arrangement, sponsorship) to active ATS crawlers.     │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 4. Career Routines  │ Shapes recommended daily coding problems, interview   │
│    & Daily Focus    │ prep topics, and weekly career review checklists.     │
└─────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 3. Career Direction Data Model

```python
class CareerDirection(Base):
    __tablename__ = "career_directions"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_career_directions_user_name"),
    )

    id: uuid.UUID                                    # Primary key
    user_id: uuid.UUID                               # Authenticated owner
    name: str                                        # e.g., "Senior Backend & Infrastructure"
    status: str                                      # "active", "paused", "archived"
    is_default: bool                                 # Primary active direction flag
    
    # Target Roles and Seniority
    target_role_family: str                          # e.g., "software_engineering"
    target_roles: list[str]                          # ["backend_engineer", "systems_engineer"]
    seniority_levels: list[str]                      # ["mid", "senior"]
    
    # Geographic & Workplace Preferences
    target_countries: list[str]                      # ["US", "CA"]
    target_cities: list[str]                         # ["New York, NY", "San Francisco, CA"]
    allowed_arrangements: list[str]                  # ["remote", "hybrid"]
    
    # Work Authorization & Compensation
    requires_sponsorship: bool
    min_base_salary: int | None
    salary_currency: str                             # "USD", "CAD"
    
    # Resume Association
    default_resume_id: uuid.UUID | None              # Foreign key to Resume
    
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None
```

---

## 4. Direction Rules and Lifecycle

1. **Direction Limits**: To maintain high candidate focus and avoid diluted signals, candidates may maintain a maximum of 5 active directions simultaneously, with one designated as `is_default = true`.
2. **Default Direction**: If a candidate opens the Jobs workspace without explicit URL filter overrides, the catalog automatically filters using their default Career Direction.
3. **Immutable History**: Archiving or modifying a Career Direction never alters past application snapshots that referenced the direction at submission time.
