import unittest
from occam_core.engine import analyze_source, OccamParetoEvaluator, ComplexityMetrics

class TestOccamEngine(unittest.TestCase):
    def test_ast_analysis_basic(self):
        sample = """
def add(a: int, b: int) -> int:
    return a + b
"""
        metrics = analyze_source(sample)
        self.assertEqual(metrics.loc, 2)
        self.assertEqual(metrics.cyclomatic_complexity, 1)
        self.assertGreater(metrics.halstead_volume, 0.0)
        self.assertEqual(metrics.safety_score, 1.0)

    def test_lyapunov_barrier_rejection(self):
        evaluator = OccamParetoEvaluator()
        sample = "def f(x): return x"
        metrics = analyze_source(sample)
        
        safe_cost = evaluator.compute_objective_cost(metrics, latency_us=5.0)
        self.assertNotEqual(safe_cost, float("inf"))

        unsafe_metrics = ComplexityMetrics(
            loc=metrics.loc,
            ast_nodes=metrics.ast_nodes,
            ast_depth=metrics.ast_depth,
            cyclomatic_complexity=metrics.cyclomatic_complexity,
            halstead_volume=metrics.halstead_volume,
            halstead_difficulty=metrics.halstead_difficulty,
            halstead_effort=metrics.halstead_effort,
            safety_score=0.0
        )
        infinite_cost = evaluator.compute_objective_cost(unsafe_metrics, latency_us=5.0)
        self.assertEqual(infinite_cost, float("inf"))

    def test_branching_complexity(self):
        sample = """
def check(val):
    if val > 0:
        return 1
    elif val < 0:
        return -1
    return 0
"""
        metrics = analyze_source(sample)
        self.assertEqual(metrics.cyclomatic_complexity, 3)

if __name__ == "__main__":
    unittest.main()
