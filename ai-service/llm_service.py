import json
from google import genai
from groq import Groq
from config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY, GROQ_MODEL

# Configure Gemini
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Configure Groq
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

BLOOM_LEVELS = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYSE", "EVALUATE", "CREATE"]


def get_next_bloom_level(current: str) -> str:
    idx = BLOOM_LEVELS.index(current) if current in BLOOM_LEVELS else 0
    next_idx = min(idx + 1, len(BLOOM_LEVELS) - 1)
    return BLOOM_LEVELS[next_idx]


def _parse_json_response(content: str):
    """Parse JSON from LLM response, handling markdown code blocks."""
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        content = content.rsplit("```", 1)[0]
    return json.loads(content)


def _call_llm(prompt: str, max_tokens: int = 4096) -> str:
    """Call Gemini as primary, fall back to Groq on failure."""
    # Try Gemini first
    if gemini_client:
        try:
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config={
                    "max_output_tokens": max_tokens,
                    "temperature": 0.7,
                },
            )
            return response.text
        except Exception as e:
            print(f"[Gemini failed] {e}, falling back to Groq...")

    # Fallback to Groq
    if groq_client:
        try:
            response = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=0.7,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"[Groq failed] {e}")
            raise RuntimeError("Both Gemini and Groq failed")

    raise RuntimeError("No LLM provider configured. Set GEMINI_API_KEY or GROQ_API_KEY.")


def extract_knowledge_units(text: str, file_name: str) -> list[dict]:
    prompt = f"""You are an educational AI that extracts knowledge units from academic documents.

Analyze the following document content and extract distinct knowledge units. Each knowledge unit should represent a specific concept that can be studied and assessed.

For each knowledge unit, provide:
- topic: The high-level topic (e.g., "Photosynthesis", "Machine Learning")
- concept: The specific concept within that topic (e.g., "Light-dependent reactions")
- sourceExcerpt: A relevant excerpt from the text (50-150 words)
- bloomLevel: The Bloom's taxonomy level most appropriate for this concept. Must be one of: REMEMBER, UNDERSTAND, APPLY, ANALYSE, EVALUATE, CREATE

Document: {file_name}

Content:
{text[:15000]}

Return your response as a JSON array of objects with keys: topic, concept, sourceExcerpt, bloomLevel.
Return ONLY the JSON array, no other text."""

    content = _call_llm(prompt, max_tokens=4096)
    return _parse_json_response(content)


def generate_socratic_question(knowledge_units: list[dict], bloom_level: str = "REMEMBER") -> dict:
    topics = ", ".join(set(ku.get("topic", "") for ku in knowledge_units[:5]))
    excerpts = "\n".join(ku.get("sourceExcerpt", "")[:200] for ku in knowledge_units[:5])

    prompt = f"""You are a Socratic tutor. Generate ONE thought-provoking question at the {bloom_level} level of Bloom's taxonomy.

Topics covered: {topics}

Source material:
{excerpts}

The question should:
- Be at the {bloom_level} level of Bloom's taxonomy
- Encourage the student to think deeply
- Be answerable from the source material
- Not be a simple yes/no question

Return ONLY a JSON object with keys: "question" (string), "bloomLevel" (string: {bloom_level})
No other text."""

    content = _call_llm(prompt, max_tokens=500)
    return _parse_json_response(content)


def generate_socratic_response(
    student_response: str,
    conversation_history: list[dict],
    current_bloom_level: str,
) -> dict:
    history_text = "\n".join(
        f"{turn['role'].upper()}: {turn['content']}" for turn in conversation_history[-10:]
    )

    next_bloom = get_next_bloom_level(current_bloom_level)

    prompt = f"""You are a Socratic tutor engaging in dialogue with a student. Your goal is to guide them to deeper understanding through questions, not give answers directly.

Conversation so far:
{history_text}

Student's latest response: {student_response}

Current Bloom's level: {current_bloom_level}

Instructions:
- Acknowledge what the student got right
- If their answer shows understanding, move to the next Bloom's level ({next_bloom})
- If their answer is incomplete or incorrect, ask a simpler guiding question at the same level
- Never give the answer directly — guide them with questions
- If the student has demonstrated understanding at EVALUATE or CREATE level, you may end the session

Return ONLY a JSON object with keys:
- "response" (string): your Socratic response/question
- "bloomLevel" (string): the Bloom's level of your response (one of: REMEMBER, UNDERSTAND, APPLY, ANALYSE, EVALUATE, CREATE)
- "isSessionComplete" (boolean): true only if student has demonstrated mastery at high Bloom's levels
No other text."""

    content = _call_llm(prompt, max_tokens=800)
    return _parse_json_response(content)


def generate_quiz_questions(knowledge_units: list[dict], count: int = 10) -> list[dict]:
    units_text = "\n\n".join(
        f"[ID: {ku.get('id', 'unknown')}] Topic: {ku.get('topic', '')} | Concept: {ku.get('concept', '')}\nExcerpt: {ku.get('sourceExcerpt', '')[:300]}"
        for ku in knowledge_units[:20]
    )

    prompt = f"""You are an educational assessment AI. Generate exactly {count} multiple-choice questions based on the following knowledge units.

Knowledge Units:
{units_text}

For each question, provide:
- knowledgeUnitId: the EXACT ID string from the [ID: ...] tag of the knowledge unit this question tests. You MUST use the original ID exactly as provided (e.g. "clxyz123..."), NOT a sequential number.
- questionText: a clear, unambiguous question
- options: exactly 4 answer choices (array of strings)
- correctIndex: index (0-3) of the correct option
- bloomLevel: the Bloom's taxonomy level (REMEMBER, UNDERSTAND, APPLY, ANALYSE, EVALUATE, CREATE)
- explanation: why the correct answer is right (shown after answering)
- sourceExcerpt: relevant excerpt from the source material

Guidelines:
- Vary Bloom's levels across questions
- Make distractors plausible but clearly wrong
- Ensure questions are directly answerable from the source material
- Each question should test a different aspect

Return ONLY a JSON array of {count} question objects. No other text."""

    content = _call_llm(prompt, max_tokens=8000)
    return _parse_json_response(content)


def generate_flashcards(knowledge_units: list[dict]) -> list[dict]:
    units_text = "\n\n".join(
        f"[ID: {ku.get('id', 'unknown')}] Topic: {ku.get('topic', '')} | Concept: {ku.get('concept', '')}\nExcerpt: {ku.get('sourceExcerpt', '')[:300]}"
        for ku in knowledge_units[:30]
    )

    prompt = f"""You are an educational AI creating flashcards for spaced repetition study.

Knowledge Units:
{units_text}

For each knowledge unit, create ONE flashcard with:
- knowledgeUnitId: the EXACT ID string from the [ID: ...] tag of the knowledge unit. You MUST use the original ID exactly as provided (e.g. "clxyz123..."), NOT a sequential number.
- front: a question, term, or prompt (concise)
- back: the answer, definition, or explanation (concise but complete)
- sourceExcerpt: relevant excerpt that supports the answer

Guidelines:
- Front should be a clear question or prompt
- Back should be a concise, complete answer
- Cards should be atomic (test one thing)
- Use the source material as the basis for accuracy

Return ONLY a JSON array of flashcard objects. No other text."""

    content = _call_llm(prompt, max_tokens=6000)
    return _parse_json_response(content)


def generate_study_summary(text: str, title: str) -> str:
    prompt = f"""You are an expert study assistant. Create concise, well-structured study notes from the following course module content.

Module: {title}

Content:
{text[:12000]}

Create study notes that:
- Start with a brief overview (2-3 sentences)
- Break the content into clear sections with headings
- Highlight key definitions, concepts, and relationships
- Use bullet points for clarity
- Include important examples or applications mentioned
- End with 3-5 key takeaways

Format the notes in Markdown. Be thorough but concise — a student should be able to review these notes in 5-10 minutes and understand the module's core content.

Return ONLY the study notes in Markdown format. No meta-commentary."""

    return _call_llm(prompt, max_tokens=4096)
