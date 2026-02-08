"""
Schedule Optimization Service
Implements Constraint Satisfaction Problem (CSP) and Genetic Algorithm
for generating optimal timetables.

This service operates in ADVISORY MODE ONLY.
It generates schedule proposals that require human approval before publication.
"""

import random
import copy
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from datetime import time
import logging

logger = logging.getLogger(__name__)


@dataclass
class Session:
    """Represents a class session to be scheduled"""
    session_id: str
    subject_id: str
    subject_name: str
    teacher_id: str
    teacher_name: str
    batch_id: str
    batch_name: str
    batch_size: int
    duration_minutes: int
    sessions_per_week: int


@dataclass
class TimeSlot:
    """Represents an available time slot"""
    day_of_week: int  # 0=Sunday, 6=Saturday
    start_time: time
    end_time: time
    
    def __hash__(self):
        return hash((self.day_of_week, self.start_time, self.end_time))
    
    def __eq__(self, other):
        return (self.day_of_week == other.day_of_week and 
                self.start_time == other.start_time and 
                self.end_time == other.end_time)


@dataclass
class Room:
    """Represents a classroom"""
    room_id: str
    room_name: str
    capacity: int
    room_type: str  # 'classroom', 'lab', 'auditorium'


@dataclass
class Assignment:
    """Represents a schedule assignment"""
    session_id: str
    time_slot: TimeSlot
    room_id: str
    
    def __hash__(self):
        return hash((self.session_id, self.time_slot, self.room_id))


class ScheduleOptimizer:
    """
    Schedule optimization using Genetic Algorithm.
    For large-scale scheduling (100+ sessions), GA is more efficient than CSP.
    """
    
    def __init__(self, sessions: List[Session], time_slots: List[TimeSlot], 
                 rooms: List[Room], population_size: int = 100, 
                 generations: int = 500):
        self.sessions = sessions
        self.time_slots = time_slots
        self.rooms = rooms
        self.population_size = population_size
        self.generations = generations
        
        # Create lookup maps for efficiency
        self.session_map = {s.session_id: s for s in sessions}
        self.room_map = {r.room_id: r for r in rooms}
        
    def generate_schedule_proposals(self, num_proposals: int = 3) -> List[Dict]:
        """
        Generate multiple schedule proposals using Genetic Algorithm.
        
        Returns:
            List of schedule proposals with fitness scores and metadata
        """
        logger.info(f"Generating {num_proposals} schedule proposals for {len(self.sessions)} sessions")
        
        # Initialize population
        population = self._initialize_population()
        
        # Evolve population
        for generation in range(self.generations):
            # Evaluate fitness
            fitness_scores = [self._calculate_fitness(schedule) for schedule in population]
            
            # Check for convergence
            if generation % 50 == 0:
                best_fitness = max(fitness_scores)
                logger.info(f"Generation {generation}: Best fitness = {best_fitness:.2f}")
            
            # Selection
            selected = self._selection(population, fitness_scores)
            
            # Crossover and mutation
            offspring = []
            for i in range(0, len(selected), 2):
                if i + 1 < len(selected):
                    child1, child2 = self._crossover(selected[i], selected[i+1])
                    offspring.extend([self._mutate(child1), self._mutate(child2)])
            
            # Replace population
            population = selected + offspring
            population = population[:self.population_size]
        
        # Get top N unique proposals
        final_fitness = [(schedule, self._calculate_fitness(schedule)) 
                        for schedule in population]
        final_fitness.sort(key=lambda x: x[1], reverse=True)
        
        # Select diverse proposals (not too similar)
        proposals = []
        for schedule, fitness in final_fitness:
            if len(proposals) >= num_proposals:
                break
            if self._is_diverse(schedule, [p['schedule'] for p in proposals]):
                proposal = self._format_proposal(schedule, fitness)
                proposals.append(proposal)
        
        # If we don't have enough diverse proposals, add the best remaining ones
        while len(proposals) < num_proposals and len(final_fitness) > len(proposals):
            schedule, fitness = final_fitness[len(proposals)]
            proposal = self._format_proposal(schedule, fitness)
            proposals.append(proposal)
        
        return proposals
    
    def _initialize_population(self) -> List[List[Assignment]]:
        """Create initial population of random schedules"""
        population = []
        for _ in range(self.population_size):
            schedule = self._generate_random_schedule()
            population.append(schedule)
        return population
    
    def _generate_random_schedule(self) -> List[Assignment]:
        """Generate a random schedule assignment"""
        schedule = []
        for session in self.sessions:
            # Randomly assign time slot and room
            time_slot = random.choice(self.time_slots)
            
            # Filter rooms by capacity
            suitable_rooms = [r for r in self.rooms if r.capacity >= session.batch_size]
            if not suitable_rooms:
                suitable_rooms = self.rooms  # Fallback to any room
            
            room = random.choice(suitable_rooms)
            
            assignment = Assignment(
                session_id=session.session_id,
                time_slot=time_slot,
                room_id=room.room_id
            )
            schedule.append(assignment)
        
        return schedule
    
    def _calculate_fitness(self, schedule: List[Assignment]) -> float:
        """
        Calculate fitness score for a schedule.
        
        Fitness = Base Score - Hard Constraint Penalties + Soft Constraint Rewards
        
        Hard Constraints (penalties):
        - Room conflict: -1000 per violation
        - Teacher conflict: -1000 per violation
        - Batch conflict: -1000 per violation
        - Room capacity exceeded: -500 per violation
        
        Soft Constraints (rewards):
        - Minimize teacher gaps: +10 per optimized session
        - Maximize room utilization: +5 per well-utilized room
        - Balanced workload: +5 per balanced day
        """
        score = 1000.0  # Base score
        
        # Hard constraint violations
        room_conflicts = self._count_room_conflicts(schedule)
        teacher_conflicts = self._count_teacher_conflicts(schedule)
        batch_conflicts = self._count_batch_conflicts(schedule)
        capacity_violations = self._count_capacity_violations(schedule)
        
        score -= room_conflicts * 1000
        score -= teacher_conflicts * 1000
        score -= batch_conflicts * 1000
        score -= capacity_violations * 500
        
        # Soft constraint optimization
        teacher_gap_score = self._calculate_teacher_gap_score(schedule)
        room_utilization_score = self._calculate_room_utilization_score(schedule)
        workload_balance_score = self._calculate_workload_balance_score(schedule)
        
        score += teacher_gap_score
        score += room_utilization_score
        score += workload_balance_score
        
        return max(0, score)  # Ensure non-negative
    
    def _count_room_conflicts(self, schedule: List[Assignment]) -> int:
        """Count room double-booking conflicts"""
        conflicts = 0
        room_schedule = {}
        
        for assignment in schedule:
            key = (assignment.room_id, assignment.time_slot)
            if key in room_schedule:
                conflicts += 1
            else:
                room_schedule[key] = assignment.session_id
        
        return conflicts
    
    def _count_teacher_conflicts(self, schedule: List[Assignment]) -> int:
        """Count teacher double-booking conflicts"""
        conflicts = 0
        teacher_schedule = {}
        
        for assignment in schedule:
            session = self.session_map[assignment.session_id]
            key = (session.teacher_id, assignment.time_slot)
            if key in teacher_schedule:
                conflicts += 1
            else:
                teacher_schedule[key] = assignment.session_id
        
        return conflicts
    
    def _count_batch_conflicts(self, schedule: List[Assignment]) -> int:
        """Count batch double-booking conflicts"""
        conflicts = 0
        batch_schedule = {}
        
        for assignment in schedule:
            session = self.session_map[assignment.session_id]
            key = (session.batch_id, assignment.time_slot)
            if key in batch_schedule:
                conflicts += 1
            else:
                batch_schedule[key] = assignment.session_id
        
        return conflicts
    
    def _count_capacity_violations(self, schedule: List[Assignment]) -> int:
        """Count room capacity violations"""
        violations = 0
        
        for assignment in schedule:
            session = self.session_map[assignment.session_id]
            room = self.room_map[assignment.room_id]
            
            if session.batch_size > room.capacity:
                violations += 1
        
        return violations
    
    def _calculate_teacher_gap_score(self, schedule: List[Assignment]) -> float:
        """
        Calculate score based on minimizing teacher gaps.
        Reward consecutive sessions, penalize large gaps.
        """
        score = 0.0
        teacher_sessions = {}
        
        # Group sessions by teacher and day
        for assignment in schedule:
            session = self.session_map[assignment.session_id]
            key = (session.teacher_id, assignment.time_slot.day_of_week)
            
            if key not in teacher_sessions:
                teacher_sessions[key] = []
            teacher_sessions[key].append(assignment.time_slot.start_time)
        
        # Calculate gaps for each teacher-day combination
        for sessions in teacher_sessions.values():
            if len(sessions) <= 1:
                continue
            
            sessions_sorted = sorted(sessions)
            for i in range(len(sessions_sorted) - 1):
                # Calculate gap in minutes
                gap_minutes = (sessions_sorted[i+1].hour * 60 + sessions_sorted[i+1].minute) - \
                             (sessions_sorted[i].hour * 60 + sessions_sorted[i].minute)
                
                # Reward small gaps (consecutive sessions)
                if gap_minutes <= 60:
                    score += 10
                elif gap_minutes <= 120:
                    score += 5
                # Penalize large gaps
                elif gap_minutes > 180:
                    score -= 5
        
        return score
    
    def _calculate_room_utilization_score(self, schedule: List[Assignment]) -> float:
        """
        Calculate score based on room utilization.
        Prefer filling larger rooms before smaller ones.
        """
        score = 0.0
        room_usage = {}
        
        for assignment in schedule:
            session = self.session_map[assignment.session_id]
            room = self.room_map[assignment.room_id]
            
            # Calculate utilization percentage
            utilization = (session.batch_size / room.capacity) * 100
            
            # Reward high utilization (80-100%)
            if 80 <= utilization <= 100:
                score += 10
            elif 60 <= utilization < 80:
                score += 5
            # Penalize very low utilization (<40%)
            elif utilization < 40:
                score -= 3
        
        return score
    
    def _calculate_workload_balance_score(self, schedule: List[Assignment]) -> float:
        """
        Calculate score based on balanced workload across days.
        Prefer even distribution of sessions.
        """
        score = 0.0
        day_counts = {i: 0 for i in range(7)}
        
        for assignment in schedule:
            day_counts[assignment.time_slot.day_of_week] += 1
        
        # Calculate standard deviation of daily session counts
        counts = list(day_counts.values())
        if counts:
            mean = sum(counts) / len(counts)
            variance = sum((x - mean) ** 2 for x in counts) / len(counts)
            std_dev = variance ** 0.5
            
            # Reward low standard deviation (balanced)
            if std_dev < 2:
                score += 20
            elif std_dev < 5:
                score += 10
        
        return score
    
    def _selection(self, population: List[List[Assignment]], 
                   fitness_scores: List[float]) -> List[List[Assignment]]:
        """Select top 20% of population (tournament selection)"""
        # Pair schedules with fitness scores
        paired = list(zip(population, fitness_scores))
        # Sort by fitness (descending)
        paired.sort(key=lambda x: x[1], reverse=True)
        # Select top 20%
        selection_size = max(2, len(population) // 5)
        selected = [schedule for schedule, _ in paired[:selection_size]]
        return selected
    
    def _crossover(self, parent1: List[Assignment], 
                   parent2: List[Assignment]) -> Tuple[List[Assignment], List[Assignment]]:
        """
        Perform crossover between two parent schedules.
        Use single-point crossover.
        """
        if len(parent1) != len(parent2):
            return parent1, parent2
        
        crossover_point = random.randint(1, len(parent1) - 1)
        
        child1 = parent1[:crossover_point] + parent2[crossover_point:]
        child2 = parent2[:crossover_point] + parent1[crossover_point:]
        
        return child1, child2
    
    def _mutate(self, schedule: List[Assignment], 
                mutation_rate: float = 0.1) -> List[Assignment]:
        """
        Mutate a schedule by randomly changing some assignments.
        Mutation rate: 10% of sessions
        """
        mutated = copy.deepcopy(schedule)
        
        for i in range(len(mutated)):
            if random.random() < mutation_rate:
                # Randomly change time slot or room
                if random.random() < 0.5:
                    # Change time slot
                    mutated[i].time_slot = random.choice(self.time_slots)
                else:
                    # Change room
                    session = self.session_map[mutated[i].session_id]
                    suitable_rooms = [r for r in self.rooms if r.capacity >= session.batch_size]
                    if suitable_rooms:
                        mutated[i].room_id = random.choice(suitable_rooms).room_id
        
        return mutated
    
    def _is_diverse(self, schedule: List[Assignment], 
                    existing_schedules: List[List[Assignment]], 
                    threshold: float = 0.3) -> bool:
        """
        Check if a schedule is sufficiently different from existing proposals.
        Returns True if similarity is below threshold.
        """
        if not existing_schedules:
            return True
        
        for existing in existing_schedules:
            similarity = self._calculate_similarity(schedule, existing)
            if similarity > (1 - threshold):
                return False
        
        return True
    
    def _calculate_similarity(self, schedule1: List[Assignment], 
                             schedule2: List[Assignment]) -> float:
        """Calculate similarity between two schedules (0-1)"""
        if len(schedule1) != len(schedule2):
            return 0.0
        
        matches = 0
        for a1, a2 in zip(schedule1, schedule2):
            if (a1.session_id == a2.session_id and 
                a1.time_slot == a2.time_slot and 
                a1.room_id == a2.room_id):
                matches += 1
        
        return matches / len(schedule1)
    
    def _format_proposal(self, schedule: List[Assignment], 
                        fitness: float) -> Dict:
        """Format a schedule proposal for API response"""
        # Calculate detailed metrics
        hard_violations = (
            self._count_room_conflicts(schedule) +
            self._count_teacher_conflicts(schedule) +
            self._count_batch_conflicts(schedule) +
            self._count_capacity_violations(schedule)
        )
        
        soft_score = (
            self._calculate_teacher_gap_score(schedule) +
            self._calculate_room_utilization_score(schedule) +
            self._calculate_workload_balance_score(schedule)
        )
        
        # Calculate average teacher gap
        teacher_gaps = self._calculate_average_teacher_gap(schedule)
        
        # Calculate room utilization percentage
        room_util = self._calculate_average_room_utilization(schedule)
        
        # Format assignments
        assignments = []
        for assignment in schedule:
            session = self.session_map[assignment.session_id]
            room = self.room_map[assignment.room_id]
            
            assignments.append({
                'session_id': assignment.session_id,
                'subject_name': session.subject_name,
                'teacher_name': session.teacher_name,
                'batch_name': session.batch_name,
                'day_of_week': assignment.time_slot.day_of_week,
                'start_time': assignment.time_slot.start_time.strftime('%H:%M'),
                'end_time': assignment.time_slot.end_time.strftime('%H:%M'),
                'room_name': room.room_name,
                'room_capacity': room.capacity,
                'batch_size': session.batch_size
            })
        
        return {
            'schedule': schedule,  # Keep for internal use
            'assignments': assignments,
            'fitness_score': round(fitness / 1000, 2),  # Normalize to 0-1 range
            'hard_constraint_violations': hard_violations,
            'soft_constraint_score': int(soft_score),
            'summary': {
                'avg_teacher_gap_minutes': round(teacher_gaps, 1),
                'room_utilization_percent': round(room_util, 1),
                'sessions_scheduled': len(schedule),
                'total_conflicts': hard_violations
            }
        }
    
    def _calculate_average_teacher_gap(self, schedule: List[Assignment]) -> float:
        """Calculate average gap between teacher sessions in minutes"""
        teacher_sessions = {}
        
        for assignment in schedule:
            session = self.session_map[assignment.session_id]
            key = (session.teacher_id, assignment.time_slot.day_of_week)
            
            if key not in teacher_sessions:
                teacher_sessions[key] = []
            teacher_sessions[key].append(assignment.time_slot.start_time)
        
        total_gap = 0
        gap_count = 0
        
        for sessions in teacher_sessions.values():
            if len(sessions) <= 1:
                continue
            
            sessions_sorted = sorted(sessions)
            for i in range(len(sessions_sorted) - 1):
                gap_minutes = (sessions_sorted[i+1].hour * 60 + sessions_sorted[i+1].minute) - \
                             (sessions_sorted[i].hour * 60 + sessions_sorted[i].minute)
                total_gap += gap_minutes
                gap_count += 1
        
        return total_gap / gap_count if gap_count > 0 else 0
    
    def _calculate_average_room_utilization(self, schedule: List[Assignment]) -> float:
        """Calculate average room utilization percentage"""
        total_util = 0
        
        for assignment in schedule:
            session = self.session_map[assignment.session_id]
            room = self.room_map[assignment.room_id]
            utilization = (session.batch_size / room.capacity) * 100
            total_util += utilization
        
        return total_util / len(schedule) if schedule else 0


def optimize_schedule(sessions_data: List[Dict], time_slots_data: List[Dict], 
                     rooms_data: List[Dict], num_proposals: int = 3) -> List[Dict]:
    """
    Main entry point for schedule optimization.
    
    Args:
        sessions_data: List of session dictionaries
        time_slots_data: List of time slot dictionaries
        rooms_data: List of room dictionaries
        num_proposals: Number of proposals to generate (default: 3)
    
    Returns:
        List of schedule proposals with fitness scores and assignments
    """
    # Convert input data to domain objects
    sessions = [
        Session(
            session_id=s['session_id'],
            subject_id=s['subject_id'],
            subject_name=s['subject_name'],
            teacher_id=s['teacher_id'],
            teacher_name=s['teacher_name'],
            batch_id=s['batch_id'],
            batch_name=s['batch_name'],
            batch_size=s['batch_size'],
            duration_minutes=s.get('duration_minutes', 60),
            sessions_per_week=s.get('sessions_per_week', 1)
        )
        for s in sessions_data
    ]
    
    time_slots = [
        TimeSlot(
            day_of_week=ts['day_of_week'],
            start_time=time.fromisoformat(ts['start_time']),
            end_time=time.fromisoformat(ts['end_time'])
        )
        for ts in time_slots_data
    ]
    
    rooms = [
        Room(
            room_id=r['room_id'],
            room_name=r['room_name'],
            capacity=r['capacity'],
            room_type=r.get('room_type', 'classroom')
        )
        for r in rooms_data
    ]
    
    # Create optimizer and generate proposals
    optimizer = ScheduleOptimizer(sessions, time_slots, rooms)
    proposals = optimizer.generate_schedule_proposals(num_proposals)
    
    # Remove internal schedule data before returning
    for proposal in proposals:
        del proposal['schedule']
    
    return proposals
