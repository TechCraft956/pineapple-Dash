#!/usr/bin/env python3
"""
Pineapple OS Backend API Testing Suite
=====================================
Comprehensive testing for all backend endpoints including:
- Health check
- Seed data
- Commands CRUD
- Tasks CRUD  
- Deals CRUD with profit/ROI calculations
- Knowledge Vault CRUD
- Build Queue CRUD
- Daily Review
- Dashboard aggregation
"""

import requests
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

class PineappleOSAPITester:
    def __init__(self, base_url: str = "https://operator-system.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_entities = {
            'commands': [],
            'tasks': [],
            'deals': [],
            'knowledge': [],
            'build_queue': []
        }

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, params: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self) -> bool:
        """Test API health check"""
        success, response = self.run_test(
            "API Health Check",
            "GET", 
            "",
            200
        )
        if success:
            print(f"   Message: {response.get('message', 'N/A')}")
            print(f"   Status: {response.get('status', 'N/A')}")
        return success

    def test_seed_data(self) -> bool:
        """Test seeding sample data"""
        success, response = self.run_test(
            "Seed Sample Data",
            "POST",
            "seed",
            200
        )
        if success:
            print(f"   Status: {response.get('status', 'N/A')}")
            print(f"   Message: {response.get('message', 'N/A')}")
        return success

    def test_commands_crud(self) -> bool:
        """Test Commands CRUD operations"""
        print("\n📝 Testing Commands Module...")
        
        # Create command
        create_data = {
            "content": "Test command entry for API testing",
            "entry_type": "note",
            "tags": ["test", "api"]
        }
        success, response = self.run_test(
            "Create Command",
            "POST",
            "commands",
            200,
            create_data
        )
        if not success:
            return False
        
        command_id = response.get('id')
        if command_id:
            self.created_entities['commands'].append(command_id)
        
        # List commands
        success, response = self.run_test(
            "List Commands",
            "GET",
            "commands",
            200,
            params={"limit": 10}
        )
        if not success:
            return False
        
        print(f"   Found {len(response)} commands")
        
        # List commands by type
        success, response = self.run_test(
            "List Commands by Type",
            "GET",
            "commands",
            200,
            params={"entry_type": "note"}
        )
        if not success:
            return False
        
        # Delete command
        if command_id:
            success, response = self.run_test(
                "Delete Command",
                "DELETE",
                f"commands/{command_id}",
                200
            )
            if success:
                self.created_entities['commands'].remove(command_id)
            return success
        
        return True

    def test_tasks_crud(self) -> bool:
        """Test Tasks CRUD operations"""
        print("\n✅ Testing Tasks Module...")
        
        # Create task
        create_data = {
            "title": "Test API Task",
            "description": "Testing task creation via API",
            "status": "todo",
            "priority": "high",
            "due_date": "2025-01-15",
            "tags": ["test", "api"]
        }
        success, response = self.run_test(
            "Create Task",
            "POST",
            "tasks",
            200,
            create_data
        )
        if not success:
            return False
        
        task_id = response.get('id')
        if task_id:
            self.created_entities['tasks'].append(task_id)
        
        # List all tasks
        success, response = self.run_test(
            "List All Tasks",
            "GET",
            "tasks",
            200
        )
        if not success:
            return False
        
        print(f"   Found {len(response)} tasks")
        
        # List tasks by status
        success, response = self.run_test(
            "List Tasks by Status",
            "GET",
            "tasks",
            200,
            params={"status": "todo"}
        )
        if not success:
            return False
        
        # Get specific task
        if task_id:
            success, response = self.run_test(
                "Get Task by ID",
                "GET",
                f"tasks/{task_id}",
                200
            )
            if not success:
                return False
        
        # Update task
        if task_id:
            update_data = {
                "status": "doing",
                "priority": "critical"
            }
            success, response = self.run_test(
                "Update Task",
                "PUT",
                f"tasks/{task_id}",
                200,
                update_data
            )
            if not success:
                return False
            
            # Verify update
            if response.get('status') == 'doing' and response.get('priority') == 'critical':
                print("   ✅ Task update verified")
            else:
                print("   ❌ Task update verification failed")
        
        # Delete task
        if task_id:
            success, response = self.run_test(
                "Delete Task",
                "DELETE",
                f"tasks/{task_id}",
                200
            )
            if success:
                self.created_entities['tasks'].remove(task_id)
            return success
        
        return True

    def test_deals_crud(self) -> bool:
        """Test Deals CRUD operations with profit/ROI calculations"""
        print("\n💰 Testing Deals Module...")
        
        # Create deal
        create_data = {
            "title": "Test API Deal",
            "category": "hardware",
            "buy_price": 1000.0,
            "sell_price": 1500.0,
            "fees": 50.0,
            "status": "open",
            "priority": "high",
            "notes": "Testing deal creation via API",
            "tags": ["test", "api"]
        }
        success, response = self.run_test(
            "Create Deal",
            "POST",
            "deals",
            200,
            create_data
        )
        if not success:
            return False
        
        deal_id = response.get('id')
        if deal_id:
            self.created_entities['deals'].append(deal_id)
        
        # Verify profit/ROI calculations
        expected_profit = 1500.0 - 1000.0 - 50.0  # 450.0
        expected_roi = (450.0 / 1000.0) * 100  # 45.0%
        
        actual_profit = response.get('estimated_profit')
        actual_roi = response.get('roi_percent')
        
        if abs(actual_profit - expected_profit) < 0.01 and abs(actual_roi - expected_roi) < 0.01:
            print(f"   ✅ Profit/ROI calculation verified: ${actual_profit}, {actual_roi}%")
        else:
            print(f"   ❌ Profit/ROI calculation failed: Expected ${expected_profit}, {expected_roi}% but got ${actual_profit}, {actual_roi}%")
        
        # List deals
        success, response = self.run_test(
            "List All Deals",
            "GET",
            "deals",
            200
        )
        if not success:
            return False
        
        print(f"   Found {len(response)} deals")
        
        # List deals by status
        success, response = self.run_test(
            "List Deals by Status",
            "GET",
            "deals",
            200,
            params={"status": "open"}
        )
        if not success:
            return False
        
        # Update deal (test recalculation)
        if deal_id:
            update_data = {
                "sell_price": 1800.0,
                "fees": 75.0
            }
            success, response = self.run_test(
                "Update Deal",
                "PUT",
                f"deals/{deal_id}",
                200,
                update_data
            )
            if not success:
                return False
            
            # Verify recalculation
            new_expected_profit = 1800.0 - 1000.0 - 75.0  # 725.0
            new_expected_roi = (725.0 / 1000.0) * 100  # 72.5%
            
            new_actual_profit = response.get('estimated_profit')
            new_actual_roi = response.get('roi_percent')
            
            if abs(new_actual_profit - new_expected_profit) < 0.01 and abs(new_actual_roi - new_expected_roi) < 0.01:
                print(f"   ✅ Updated profit/ROI calculation verified: ${new_actual_profit}, {new_actual_roi}%")
            else:
                print(f"   ❌ Updated profit/ROI calculation failed")
        
        # Delete deal
        if deal_id:
            success, response = self.run_test(
                "Delete Deal",
                "DELETE",
                f"deals/{deal_id}",
                200
            )
            if success:
                self.created_entities['deals'].remove(deal_id)
            return success
        
        return True

    def test_knowledge_crud(self) -> bool:
        """Test Knowledge Vault CRUD operations"""
        print("\n📚 Testing Knowledge Vault Module...")
        
        # Create knowledge entry
        create_data = {
            "title": "Test API Knowledge Entry",
            "content": "This is a test knowledge entry created via API testing.\n\nIt contains multiple lines and formatting.",
            "category": "reference",
            "tags": ["test", "api", "reference"]
        }
        success, response = self.run_test(
            "Create Knowledge Entry",
            "POST",
            "knowledge",
            200,
            create_data
        )
        if not success:
            return False
        
        knowledge_id = response.get('id')
        if knowledge_id:
            self.created_entities['knowledge'].append(knowledge_id)
        
        # List knowledge entries
        success, response = self.run_test(
            "List Knowledge Entries",
            "GET",
            "knowledge",
            200
        )
        if not success:
            return False
        
        print(f"   Found {len(response)} knowledge entries")
        
        # List by category
        success, response = self.run_test(
            "List Knowledge by Category",
            "GET",
            "knowledge",
            200,
            params={"category": "reference"}
        )
        if not success:
            return False
        
        # Search knowledge
        success, response = self.run_test(
            "Search Knowledge",
            "GET",
            "knowledge",
            200,
            params={"search": "API testing"}
        )
        if not success:
            return False
        
        # Get specific entry
        if knowledge_id:
            success, response = self.run_test(
                "Get Knowledge Entry by ID",
                "GET",
                f"knowledge/{knowledge_id}",
                200
            )
            if not success:
                return False
        
        # Update knowledge entry
        if knowledge_id:
            update_data = {
                "content": "Updated content for API testing knowledge entry.",
                "category": "sop"
            }
            success, response = self.run_test(
                "Update Knowledge Entry",
                "PUT",
                f"knowledge/{knowledge_id}",
                200,
                update_data
            )
            if not success:
                return False
        
        # Delete knowledge entry
        if knowledge_id:
            success, response = self.run_test(
                "Delete Knowledge Entry",
                "DELETE",
                f"knowledge/{knowledge_id}",
                200
            )
            if success:
                self.created_entities['knowledge'].remove(knowledge_id)
            return success
        
        return True

    def test_build_queue_crud(self) -> bool:
        """Test Build Queue CRUD operations"""
        print("\n🔧 Testing Build Queue Module...")
        
        # Create build queue item
        create_data = {
            "title": "Test API Build Item",
            "description": "Testing build queue item creation via API",
            "status": "requested",
            "priority": "medium",
            "rationale": "Need to test API functionality",
            "tags": ["test", "api"]
        }
        success, response = self.run_test(
            "Create Build Queue Item",
            "POST",
            "build-queue",
            200,
            create_data
        )
        if not success:
            return False
        
        build_id = response.get('id')
        if build_id:
            self.created_entities['build_queue'].append(build_id)
        
        # List build queue items
        success, response = self.run_test(
            "List Build Queue Items",
            "GET",
            "build-queue",
            200
        )
        if not success:
            return False
        
        print(f"   Found {len(response)} build queue items")
        
        # List by status
        success, response = self.run_test(
            "List Build Queue by Status",
            "GET",
            "build-queue",
            200,
            params={"status": "requested"}
        )
        if not success:
            return False
        
        # Update build queue item
        if build_id:
            update_data = {
                "status": "planning",
                "priority": "high"
            }
            success, response = self.run_test(
                "Update Build Queue Item",
                "PUT",
                f"build-queue/{build_id}",
                200,
                update_data
            )
            if not success:
                return False
        
        # Delete build queue item
        if build_id:
            success, response = self.run_test(
                "Delete Build Queue Item",
                "DELETE",
                f"build-queue/{build_id}",
                200
            )
            if success:
                self.created_entities['build_queue'].remove(build_id)
            return success
        
        return True

    def test_daily_review(self) -> bool:
        """Test Daily Review functionality"""
        print("\n📅 Testing Daily Review Module...")
        
        # Get daily review
        success, response = self.run_test(
            "Get Daily Review",
            "GET",
            "daily-review",
            200
        )
        if not success:
            return False
        
        print(f"   Date: {response.get('date', 'N/A')}")
        print(f"   Activities: {len(response.get('activities', []))}")
        print(f"   Summary: {response.get('summary', {})}")
        
        # Save daily review
        save_data = {
            "next_actions": "Test next actions via API",
            "reflections": "Test reflections via API - everything working well!"
        }
        success, response = self.run_test(
            "Save Daily Review",
            "PUT",
            "daily-review",
            200,
            save_data
        )
        if not success:
            return False
        
        print(f"   Saved for date: {response.get('date', 'N/A')}")
        
        return True

    def test_dashboard(self) -> bool:
        """Test Dashboard aggregation"""
        print("\n📊 Testing Dashboard Module...")
        
        success, response = self.run_test(
            "Get Dashboard Data",
            "GET",
            "dashboard",
            200
        )
        if not success:
            return False
        
        # Verify dashboard structure
        required_keys = ['task_counts', 'deal_counts', 'knowledge_count', 'build_queue_count', 
                        'recent_activity', 'priority_tasks', 'priority_deals', 'today_activity_count']
        
        missing_keys = [key for key in required_keys if key not in response]
        if missing_keys:
            print(f"   ❌ Missing dashboard keys: {missing_keys}")
            return False
        
        print(f"   ✅ Dashboard structure verified")
        print(f"   Task counts: {response.get('task_counts', {})}")
        print(f"   Deal counts: {response.get('deal_counts', {})}")
        print(f"   Knowledge count: {response.get('knowledge_count', 0)}")
        print(f"   Build queue count: {response.get('build_queue_count', 0)}")
        print(f"   Recent activities: {len(response.get('recent_activity', []))}")
        print(f"   Priority tasks: {len(response.get('priority_tasks', []))}")
        print(f"   Priority deals: {len(response.get('priority_deals', []))}")
        print(f"   Today activity count: {response.get('today_activity_count', 0)}")
        
        return True

    def test_activity_log(self) -> bool:
        """Test Activity Log"""
        print("\n📋 Testing Activity Log...")
        
        success, response = self.run_test(
            "Get Activity Log",
            "GET",
            "activity",
            200,
            params={"limit": 20}
        )
        if not success:
            return False
        
        print(f"   Found {len(response)} activity entries")
        
        return True

    def cleanup_created_entities(self):
        """Clean up any entities created during testing"""
        print("\n🧹 Cleaning up test entities...")
        
        for entity_type, ids in self.created_entities.items():
            for entity_id in ids[:]:  # Copy list to avoid modification during iteration
                endpoint_map = {
                    'commands': f'commands/{entity_id}',
                    'tasks': f'tasks/{entity_id}',
                    'deals': f'deals/{entity_id}',
                    'knowledge': f'knowledge/{entity_id}',
                    'build_queue': f'build-queue/{entity_id}'
                }
                
                if entity_type in endpoint_map:
                    success, _ = self.run_test(
                        f"Cleanup {entity_type} {entity_id}",
                        "DELETE",
                        endpoint_map[entity_type],
                        200
                    )
                    if success:
                        self.created_entities[entity_type].remove(entity_id)

    def run_all_tests(self) -> int:
        """Run all tests and return exit code"""
        print("🍍 Pineapple OS Backend API Testing Suite")
        print("=" * 50)
        
        try:
            # Core functionality tests
            if not self.test_health_check():
                print("❌ Health check failed - stopping tests")
                return 1
            
            # Seed data (optional - may already be seeded)
            self.test_seed_data()
            
            # CRUD tests for all modules
            if not self.test_commands_crud():
                print("❌ Commands CRUD tests failed")
                return 1
            
            if not self.test_tasks_crud():
                print("❌ Tasks CRUD tests failed")
                return 1
            
            if not self.test_deals_crud():
                print("❌ Deals CRUD tests failed")
                return 1
            
            if not self.test_knowledge_crud():
                print("❌ Knowledge Vault CRUD tests failed")
                return 1
            
            if not self.test_build_queue_crud():
                print("❌ Build Queue CRUD tests failed")
                return 1
            
            # Aggregation and review tests
            if not self.test_daily_review():
                print("❌ Daily Review tests failed")
                return 1
            
            if not self.test_dashboard():
                print("❌ Dashboard tests failed")
                return 1
            
            if not self.test_activity_log():
                print("❌ Activity Log tests failed")
                return 1
            
            # Print final results
            print("\n" + "=" * 50)
            print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run} passed")
            
            if self.tests_passed == self.tests_run:
                print("🎉 All tests passed!")
                return 0
            else:
                print(f"❌ {self.tests_run - self.tests_passed} tests failed")
                return 1
                
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
            return 1
        except Exception as e:
            print(f"\n💥 Unexpected error: {str(e)}")
            return 1
        finally:
            # Always try to clean up
            self.cleanup_created_entities()

def main():
    """Main entry point"""
    tester = PineappleOSAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())