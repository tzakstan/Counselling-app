import os
import json
from typing import List, Optional
from models import Student, QuestionnaireData, ClinicalObservations, Comment, GeneratedReport, CumulativeReport
from gemini_service import generate_individual_report, generate_cumulative_report

DB_FILE = os.path.join(os.path.dirname(__file__), "students_db.json")
CUMULATIVE_FILE = os.path.join(os.path.dirname(__file__), "cumulative_db.json")

def _init_seed_data() -> List[Student]:
    # 1. Abbas Juzer bhai Malek (From the user's exact provided sheet!)
    s1 = Student(
        id="SI-2026-001",
        name="Abbas Juzer bhai Malek",
        age=16,
        fathers_occupation="Business",
        mothers_occupation="Business",
        place="Raipur",
        batch="Batch 2026-A",
        is_confidential=False,
        status="Evaluated",
        questionnaire=QuestionnaireData(
            pre_session_query="",
            strengths_rely_on="Morning namaaz wake up, to hang clothes properly",
            weaknesses_not_rely_on="Household chores not doing sometimes",
            worry_overthink="Exam results _ switching to solution oriented thinking",
            enjoy_3_things="Cricket, friends, TV",
            insecure_uncomfortable="Laptop that is very dear, Ammi Abba, Dada Dadi",
            proud_of_yourself="My friends rely on me",
            confidence_source="Any competition in sports_ I'm prepared so I'm confident",
            feel_understood="Yes",
            go_to_person="Elder sister",
            parents_different="All okay",
            study_motivation="Both_ I have to and I like to",
            future_career="May be MBBS",
            adult_life_imagined="Life adventures _ solo travelling",
            fears_barriers_future="Not as such",
            alter_improve_self="Handwriting",
            magic_button_wish="Flying power I wish, want to fly like birds in the sky",
            session_feeling="Relaxing",
            unshared_thoughts="Nothing as such",
            takeaway="Nothing specific and got a good experience.",
            moula_guidance_practice="Not using phone much and reducing it_ I'm trying."
        ),
        observations=ClinicalObservations(
            emotional_expression="Fully Expressive",
            confidence_level="Confident",
            anxiety_restlessness="A little bit",
            clarity_vs_confusion="Clear",
            family_pressure_themes="No",
            fear_of_failure_judgement="Mild",
            motivational_level="High",
            identity_struggles="None Observed",
            peer_influence="Positive",
            emotional_maturity="Good"
        ),
        counsellor_raw_remarks="Seems all is good. Well-mannered and respectful.",
        prescribed_exercise_raw="1. Solution-oriented cognitive reframing journal.\n2. Handwriting refinement practice.\n3. Digital mindfulness log for screen time.",
        comments=[
            Comment(
                id="c-1",
                author="Shk. Murtaza (Program Head)",
                role="Management",
                text="Excellent profile. Very glad to see his morning Namaaz discipline and focus on reducing screen time.",
                timestamp="12 Oct 2026, 10:45 AM"
            )
        ],
        created_at="2026-10-12T09:30:00",
        updated_at="2026-10-12T10:45:00"
    )
    s1.report = generate_individual_report(s1)

    # 2. Mohammed Ali Asgar bhai Rangwala (Critical / Follow-up case)
    s2 = Student(
        id="SI-2026-002",
        name="Mohammed Ali Asgar bhai Rangwala",
        age=15,
        fathers_occupation="Manufacturing Business",
        mothers_occupation="Homemaker",
        place="Mumbai",
        batch="Batch 2026-A",
        is_confidential=False,
        status="Follow-up Scheduled",
        questionnaire=QuestionnaireData(
            pre_session_query="How to stop worrying about 10th boards exam constantly?",
            strengths_rely_on="Helping others in studies, being punctual",
            weaknesses_not_rely_on="Public speaking or speaking in front of elders",
            worry_overthink="What if I don't score above 90% and disappoint father",
            enjoy_3_things="Reading, cycling alone, computer games",
            insecure_uncomfortable="When relatives ask about career plans and compare with cousins",
            proud_of_yourself="Never missed a session in madrasah",
            confidence_source="When I study thoroughly alone in silence",
            feel_understood="Sometimes, but parents have very high expectations",
            go_to_person="Nobody really, keep things to myself",
            parents_different="Wish father would listen more instead of advising immediately",
            study_motivation="Mostly pressure to maintain family standard",
            future_career="Software / Tech, but family wants me in hardware trade",
            adult_life_imagined="Independent, peaceful job without daily arguments",
            fears_barriers_future="Fear of letting down parents",
            alter_improve_self="Stop hesitating and learn to speak up",
            magic_button_wish="That everyone would understand what I truly want without getting upset",
            session_feeling="Relieved that I could talk openly without being judged",
            unshared_thoughts="Scared about the upcoming tests next month",
            takeaway="Learned that anxiety is natural but needs healthy outlets.",
            moula_guidance_practice="Trying to keep temper calm and recite Dua every morning."
        ),
        observations=ClinicalObservations(
            emotional_expression="Somewhat Constricted",
            confidence_level="Low to Fluctuating",
            anxiety_restlessness="High",
            clarity_vs_confusion="Somewhat Confused",
            family_pressure_themes="Yes",
            fear_of_failure_judgement="Severe",
            motivational_level="Moderate",
            identity_struggles="Moderate",
            peer_influence="Isolated",
            emotional_maturity="Developing"
        ),
        counsellor_raw_remarks="Carrying noticeable performance anxiety and perceived parental pressure. Tends to internalize stress. Needs emotional buffering and confidence building.",
        prescribed_exercise_raw="1. Deep breathing 4-7-8 routine before bed.\n2. Journaling 'Expectation vs Reality'.\n3. Scheduled 2nd counselling session on Day 5.",
        comments=[
            Comment(
                id="c-2",
                author="Counsellor Fatima",
                role="Counsellor",
                text="Flagged for a second session. Will also coordinate with his dorm mentor to ensure he is socializing during sports hour.",
                timestamp="12 Oct 2026, 11:15 AM"
            ),
            Comment(
                id="c-3",
                author="Mulla Husain (Supervisor)",
                role="Management",
                text="Noted. I know his family in Mumbai; let's support him with encouragement and keep pressure off during the camp.",
                timestamp="12 Oct 2026, 11:30 AM"
            )
        ],
        created_at="2026-10-12T10:00:00",
        updated_at="2026-10-12T11:30:00"
    )
    s2.report = generate_individual_report(s2)

    # 3. Taher Husain bhai Jamali (Mild observation case)
    s3 = Student(
        id="SI-2026-003",
        name="Taher Husain bhai Jamali",
        age=14,
        fathers_occupation="Textile Trading",
        mothers_occupation="Teacher",
        place="Surat",
        batch="Batch 2026-A",
        is_confidential=False,
        status="Evaluated",
        questionnaire=QuestionnaireData(
            pre_session_query="",
            strengths_rely_on="Making friends laugh, sports teamwork",
            weaknesses_not_rely_on="Staying organized and keeping room clean",
            worry_overthink="Missing home and mother's cooking during first 2 days",
            enjoy_3_things="Football, playing synthesizer, outdoor trips",
            insecure_uncomfortable="Being in a huge crowd where I know nobody",
            proud_of_yourself="Selected as captain for local football team",
            confidence_source="Support of teammates and encouragement from coaches",
            feel_understood="Yes, very close to mother",
            go_to_person="Mother",
            parents_different="Nothing, they are very supportive",
            study_motivation="I want to learn, but easily get distracted by social media",
            future_career="Architecture or Design",
            adult_life_imagined="Building innovative houses and mosques",
            fears_barriers_future="Math scores sometimes dip",
            alter_improve_self="Focus and time management",
            magic_button_wish="Teleportation to visit family whenever I want",
            session_feeling="Very friendly and fun",
            unshared_thoughts="None",
            takeaway="Need to be more disciplined with hostel routine.",
            moula_guidance_practice="Staying focused on Ilm and showing adab to teachers and peers."
        ),
        observations=ClinicalObservations(
            emotional_expression="Fully Expressive",
            confidence_level="Fluctuating",
            anxiety_restlessness="A little bit",
            clarity_vs_confusion="Clear",
            family_pressure_themes="No",
            fear_of_failure_judgement="Mild",
            motivational_level="High",
            identity_struggles="None Observed",
            peer_influence="Positive",
            emotional_maturity="Good"
        ),
        counsellor_raw_remarks="High energy, likable boy. Initial mild homesickness which is rapidly subsiding as he makes peers in the hostel.",
        prescribed_exercise_raw="1. Room organization habit check before morning assembly.\n2. Active participation in evening football matches.",
        comments=[],
        created_at="2026-10-12T10:30:00",
        updated_at="2026-10-12T10:30:00"
    )
    s3.report = generate_individual_report(s3)

    return [s1, s2, s3]


def load_students() -> List[Student]:
    if not os.path.exists(DB_FILE):
        seeds = _init_seed_data()
        save_students(seeds)
        return seeds
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # If the file exists, return the exact data (even if empty list [])
            return [Student(**item) for item in data]
    except Exception:
        return []


def save_students(students: List[Student]):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump([s.model_dump() for s in students], f, indent=2, ensure_ascii=False)


def get_student_by_id(student_id: str) -> Optional[Student]:
    students = load_students()
    for s in students:
        if s.id == student_id:
            return s
    return None


def save_or_update_student(student: Student) -> Student:
    students = load_students()
    updated = False
    for i, s in enumerate(students):
        if s.id == student.id:
            students[i] = student
            updated = True
            break
    if not updated:
        students.append(student)
    save_students(students)
    return student

def delete_student(student_id: str) -> bool:
    students = load_students()
    initial_len = len(students)
    students = [s for s in students if s.id != student_id]
    if len(students) < initial_len:
        save_students(students)
        return True
    return False

def get_or_create_cumulative_report() -> CumulativeReport:
    students = load_students()
    rep = generate_cumulative_report(students)
    with open(CUMULATIVE_FILE, "w", encoding="utf-8") as f:
        json.dump(rep.model_dump(), f, indent=2, ensure_ascii=False)
    return rep

