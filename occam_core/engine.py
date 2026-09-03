from __future__ import annotations
import ast
import math
import time
from dataclasses import dataclass
from typing import Dict, List, Set, Tuple, Any, Optional

@dataclass(frozen=True)
class ComplexityMetrics:
    loc: int
    ast_nodes: int
    ast_depth: int
    cyclomatic_complexity: int
    halstead_volume: float
    halstead_difficulty: float
    halstead_effort: float
    safety_score: float

class ASTComplexityAnalyzer(ast.NodeVisitor):
    def __init__(self) -> None:
        self.nodes: int = 0
        self.max_depth: int = 0
        self.current_depth: int = 0
        self.operators: Set[str] = set()
        self.operands: Set[str] = set()
        self.n_operators: int = 0
        self.n_operands: int = 0
        self.decision_points: int = 0

    def generic_visit(self, node: ast.AST) -> None:
        self.nodes += 1
        self.current_depth += 1
        if self.current_depth > self.max_depth:
            self.max_depth = self.current_depth

        if isinstance(node, (ast.If, ast.While, ast.For, ast.ExceptHandler, ast.With, ast.Assert)):
            self.decision_points += 1
        elif isinstance(node, ast.BoolOp):
            self.decision_points += max(len(node.values) - 1, 1)

        node_name = type(node).__name__
        if isinstance(node, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
                            ast.LShift, ast.RShift, ast.BitOr, ast.BitXor, ast.BitAnd,
                            ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
                            ast.Is, ast.IsNot, ast.In, ast.NotIn,
                            ast.And, ast.Or, ast.Not, ast.Invert,
                            ast.Assign, ast.AugAssign, ast.Call)):
            self.operators.add(node_name)
            self.n_operators += 1
        elif isinstance(node, (ast.Name, ast.Constant)):
            val = getattr(node, "id", getattr(node, "value", None))
            self.operands.add(str(val))
            self.n_operands += 1

        super().generic_visit(node)
        self.current_depth -= 1

def analyze_source(source_code: str) -> ComplexityMetrics:
    cleaned_lines = [
        line.strip() for line in source_code.strip().splitlines() 
        if line.strip() and not line.strip().startswith("#")
    ]
    loc = len(cleaned_lines)
    tree = ast.parse(source_code)
    analyzer = ASTComplexityAnalyzer()
    analyzer.visit(tree)

    n1 = max(len(analyzer.operators), 1)
    n2 = max(len(analyzer.operands), 1)
    N1 = max(analyzer.n_operators, 1)
    N2 = max(analyzer.n_operands, 1)

    vocabulary = n1 + n2
    length = N1 + N2
    volume = length * math.log2(vocabulary) if vocabulary > 1 else 0.0
    difficulty = (n1 / 2.0) * (N2 / float(n2))
    effort = difficulty * volume
    cyclomatic = analyzer.decision_points + 1

    return ComplexityMetrics(
        loc=loc,
        ast_nodes=analyzer.nodes,
        ast_depth=analyzer.max_depth,
        cyclomatic_complexity=cyclomatic,
        halstead_volume=volume,
        halstead_difficulty=difficulty,
        halstead_effort=effort,
        safety_score=1.0
    )

class OccamParetoEvaluator:
    def __init__(self, alpha: float = 0.3, beta: float = 0.4, gamma: float = 0.3):
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma

    def compute_objective_cost(self, metrics: ComplexityMetrics, latency_us: float) -> float:
        if metrics.safety_score < 1.0:
            return float("inf")
        return (
            self.alpha * (metrics.halstead_volume / 100.0) +
            self.beta * metrics.cyclomatic_complexity +
            self.gamma * (latency_us / 10.0)
        )
