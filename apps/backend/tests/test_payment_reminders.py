"""
Pytest tests for Payment Reminders functionality.
Tests CRUD operations, API endpoints, email functionality, and edge cases.
"""

import pytest
import pytest_asyncio
from datetime import date, datetime, timedelta
from uuid import uuid4
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from httpx import Response

from app.main import app
from app.database.database import get_db
from app.models.payment_reminders import PaymentReminder
from app.models.credit_card_instructions import CreditCardInstructions
from app.crud.payment_reminders import CRUDPaymentReminder
from app.schemas.payment_reminders import PaymentReminderCreate, PaymentReminderUpdate
from app.service.payment_reminders_email_manager import PaymentRemindersEmailManager


# Test Constants
TEST_USER_ID = uuid4()
TEST_CARD_ID = uuid4()
TEST_EMAIL = "test@example.com"


# Mock Database Dependency
async def mock_get_db():
    """Mock database dependency for FastAPI testing."""
    mock_session = Mock(spec=AsyncSession)
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.close = AsyncMock()
    mock_session.add = Mock()
    mock_session.delete = AsyncMock()
    mock_session.execute = AsyncMock()
    
    # Mock query result structure
    mock_result = Mock()
    mock_result.scalars.return_value.first.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = mock_result
    
    yield mock_session


# Override the dependency
app.dependency_overrides[get_db] = mock_get_db

# Test Client
client = TestClient(app)


# Fixtures
@pytest_asyncio.fixture
async def mock_db_session():
    """Mock database session for testing."""
    mock_session = Mock(spec=AsyncSession)
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.close = AsyncMock()
    mock_session.add = Mock()
    mock_session.delete = AsyncMock()
    
    # Mock query result structure
    mock_result = Mock()
    mock_result.scalars.return_value.first.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = mock_result
    
    return mock_session


@pytest.fixture
def sample_reminder_data():
    """Sample reminder data for testing."""
    return {
        "user_id": str(TEST_USER_ID),
        "card_id": str(TEST_CARD_ID),
        "scheduled_date": (date.today() + timedelta(days=1)).isoformat(),
        "email": TEST_EMAIL,
        "days_before_due": 3
    }


@pytest.fixture
def sample_reminder_create():
    """Sample PaymentReminderCreate object."""
    return PaymentReminderCreate(
        user_id=TEST_USER_ID,
        card_id=TEST_CARD_ID,
        scheduled_date=date.today() + timedelta(days=1),
        email=TEST_EMAIL,
        days_before_due=3
    )


@pytest.fixture
def sample_reminder_model():
    """Sample PaymentReminder model instance."""
    return PaymentReminder(
        id=uuid4(),
        user_id=TEST_USER_ID,
        card_id=TEST_CARD_ID,
        scheduled_date=date.today() + timedelta(days=1),
        email=TEST_EMAIL,
        days_before_due=3,
        status="pending",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )


@pytest.fixture
def sample_card_model():
    """Sample CreditCardInstructions model instance."""
    return CreditCardInstructions(
        id=TEST_CARD_ID,
        user_id=TEST_USER_ID,
        card_name="Test Card",
        payment_day=15,
        description="Test card description",
        instruction="Test payment instruction",
        is_paid=False,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )


# CRUD Tests
class TestCRUDPaymentReminder:
    """Test CRUD operations for PaymentReminder."""

    @pytest.mark.asyncio
    async def test_create_reminder(self, mock_db_session, sample_reminder_create, sample_reminder_model):
        """Test creating a payment reminder."""
        # Setup
        crud = CRUDPaymentReminder(mock_db_session)
        
        # Mock the database operations
        mock_db_session.refresh.side_effect = lambda obj: setattr(obj, 'id', sample_reminder_model.id)
        
        # Execute
        result = await crud.create(obj_in=sample_reminder_create)
        
        # Assertions
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()
        assert result.user_id == sample_reminder_create.user_id

    @pytest.mark.asyncio
    async def test_get_reminder(self, mock_db_session, sample_reminder_model):
        """Test retrieving a payment reminder by ID."""
        # Setup
        crud = CRUDPaymentReminder(mock_db_session)
        mock_result = Mock()
        mock_result.scalars.return_value.first.return_value = sample_reminder_model
        mock_db_session.execute.return_value = mock_result
        
        # Execute
        result = await crud.get(id=sample_reminder_model.id, user_id=TEST_USER_ID)
        
        # Assertions
        assert result == sample_reminder_model
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_multi_by_user(self, mock_db_session, sample_reminder_model):
        """Test retrieving multiple reminders by user."""
        # Setup
        crud = CRUDPaymentReminder(mock_db_session)
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [sample_reminder_model]
        mock_db_session.execute.return_value = mock_result
        
        # Execute
        result = await crud.get_multi_by_user(user_id=TEST_USER_ID, return_all=True)
        
        # Assertions
        assert len(result) == 1
        assert result[0] == sample_reminder_model
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_multi_by_card(self, mock_db_session, sample_reminder_model):
        """Test retrieving reminders by card ID."""
        # Setup
        crud = CRUDPaymentReminder(mock_db_session)
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [sample_reminder_model]
        mock_db_session.execute.return_value = mock_result
        
        # Execute
        result = await crud.get_multi_by_card(card_id=TEST_CARD_ID, user_id=TEST_USER_ID)
        
        # Assertions
        assert len(result) == 1
        assert result[0] == sample_reminder_model

    @pytest.mark.asyncio
    async def test_get_due_today(self, mock_db_session, sample_reminder_model):
        """Test retrieving reminders due today."""
        # Setup
        crud = CRUDPaymentReminder(mock_db_session)
        sample_reminder_model.scheduled_date = date.today()
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [sample_reminder_model]
        mock_db_session.execute.return_value = mock_result
        
        # Execute
        result = await crud.get_due_today(target_date=date.today())
        
        # Assertions
        assert len(result) == 1
        assert result[0] == sample_reminder_model

    @pytest.mark.asyncio
    async def test_mark_as_sent(self, mock_db_session, sample_reminder_model):
        """Test marking a reminder as sent."""
        # Setup
        crud = CRUDPaymentReminder(mock_db_session)
        
        with patch.object(crud, 'get', return_value=sample_reminder_model):
            with patch.object(crud, 'update', return_value=sample_reminder_model) as mock_update:
                # Execute
                result = await crud.mark_as_sent(reminder_id=sample_reminder_model.id, user_id=TEST_USER_ID)
                
                # Assertions
                assert result == sample_reminder_model
                mock_update.assert_called_once()
                # Check that update was called with correct status
                call_args = mock_update.call_args
                assert call_args[1]['obj_in']['status'] == 'sent'
                assert 'sent_at' in call_args[1]['obj_in']

    @pytest.mark.asyncio
    async def test_mark_as_failed(self, mock_db_session, sample_reminder_model):
        """Test marking a reminder as failed."""
        # Setup
        crud = CRUDPaymentReminder(mock_db_session)
        
        with patch.object(crud, 'get', return_value=sample_reminder_model):
            with patch.object(crud, 'update', return_value=sample_reminder_model) as mock_update:
                # Execute
                result = await crud.mark_as_failed(reminder_id=sample_reminder_model.id, user_id=TEST_USER_ID)
                
                # Assertions
                assert result == sample_reminder_model
                mock_update.assert_called_once()
                call_args = mock_update.call_args
                assert call_args[1]['obj_in']['status'] == 'failed'

    @pytest.mark.asyncio
    async def test_cancel_reminders_for_card(self, mock_db_session, sample_reminder_model):
        """Test cancelling all reminders for a card."""
        # Setup
        crud = CRUDPaymentReminder(mock_db_session)
        
        with patch.object(crud, 'get_multi_by_card', return_value=[sample_reminder_model]):
            with patch.object(crud, 'update', return_value=sample_reminder_model):
                # Execute
                result = await crud.cancel_reminders_for_card(card_id=TEST_CARD_ID, user_id=TEST_USER_ID)
                
                # Assertions
                assert result == 1  # Should return count of cancelled reminders


# API Tests
class TestPaymentReminderAPI:
    """Test Payment Reminder API endpoints."""

    @patch('app.api.payment_reminders.CRUDPaymentReminder')
    def test_create_reminder_endpoint(self, mock_crud_class, sample_reminder_data):
        """Test POST /payment-reminders/ endpoint."""
        # Setup mock
        mock_crud = mock_crud_class.return_value
        
        # Create a properly structured mock reminder response
        mock_reminder = PaymentReminder(
            id=uuid4(),
            user_id=TEST_USER_ID,
            card_id=TEST_CARD_ID,
            scheduled_date=date.today() + timedelta(days=1),
            email=TEST_EMAIL,
            days_before_due=3,
            status="pending",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        mock_crud.create = AsyncMock(return_value=mock_reminder)
        
        # Execute
        response = client.post("/payment-reminders/", json=sample_reminder_data)
        
        # Assertions
        assert response.status_code == 201

    @patch('app.api.payment_reminders.CRUDPaymentReminder')
    def test_get_reminders_endpoint(self, mock_crud_class):
        """Test GET /payment-reminders/ endpoint."""
        # Setup mock
        mock_crud = mock_crud_class.return_value
        mock_crud.get_multi_by_user = AsyncMock(return_value=[])
        
        # Execute
        response = client.get(f"/payment-reminders/?user_id={TEST_USER_ID}")
        
        # Assertions
        assert response.status_code == 200
        assert response.json() == []

    @patch('app.api.payment_reminders.CRUDPaymentReminder')
    def test_get_reminders_by_card_endpoint(self, mock_crud_class):
        """Test GET /payment-reminders/card/{card_id} endpoint."""
        # Setup mock
        mock_crud = mock_crud_class.return_value
        mock_crud.get_multi_by_card = AsyncMock(return_value=[])
        
        # Execute
        response = client.get(f"/payment-reminders/card/{TEST_CARD_ID}?user_id={TEST_USER_ID}")
        
        # Assertions
        assert response.status_code == 200

    @patch('app.api.payment_reminders.CRUDPaymentReminder')
    def test_get_due_today_endpoint(self, mock_crud_class):
        """Test GET /payment-reminders/due-today endpoint."""
        # Setup mock
        mock_crud = mock_crud_class.return_value
        mock_crud.get_due_today = AsyncMock(return_value=[])
        
        # Execute
        response = client.get("/payment-reminders/due-today")
        
        # Assertions
        assert response.status_code == 200

    @patch('app.api.payment_reminders.CRUDPaymentReminder')
    def test_mark_sent_endpoint(self, mock_crud_class):
        """Test PUT /payment-reminders/{reminder_id}/mark-sent endpoint."""
        reminder_id = uuid4()
        
        # Setup mock
        mock_crud = mock_crud_class.return_value
        
        # Create a properly structured mock reminder
        mock_reminder = PaymentReminder(
            id=reminder_id,
            user_id=TEST_USER_ID,
            card_id=TEST_CARD_ID,
            scheduled_date=date.today(),
            email=TEST_EMAIL,
            days_before_due=3,
            status="sent",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            sent_at=datetime.now()
        )
        
        mock_crud.mark_as_sent = AsyncMock(return_value=mock_reminder)
        
        # Execute
        response = client.put(f"/payment-reminders/{reminder_id}/mark-sent?user_id={TEST_USER_ID}")
        
        # Assertions
        assert response.status_code == 200

    @patch('app.api.payment_reminders.CRUDPaymentReminder')
    def test_cancel_reminders_endpoint(self, mock_crud_class):
        """Test DELETE /payment-reminders/card/{card_id}/cancel endpoint."""
        # Setup mock
        mock_crud = mock_crud_class.return_value
        mock_crud.cancel_reminders_for_card = AsyncMock(return_value=2)
        
        # Execute
        response = client.delete(f"/payment-reminders/card/{TEST_CARD_ID}/cancel?user_id={TEST_USER_ID}")
        
        # Assertions
        assert response.status_code == 200
        assert response.json()["cancelled_count"] == 2

    @patch('app.api.payment_reminders.CRUDPaymentReminder')
    def test_pagination_with_large_offset(self, mock_crud_class):
        """Test pagination with offset larger than available records."""
        # Setup mock
        mock_crud = mock_crud_class.return_value
        mock_crud.get_multi_by_user = AsyncMock(return_value=[])
        
        # Execute
        response = client.get(f"/payment-reminders/?user_id={TEST_USER_ID}&skip=1000&limit=10")
        
        # Assertions
        assert response.status_code == 200
        assert response.json() == []


# Email Manager Tests
class TestPaymentRemindersEmailManager:
    """Test Payment Reminders Email Manager."""

    @pytest.mark.asyncio
    async def test_send_payment_reminders_no_reminders_due(self, mock_db_session):
        """Test sending reminders when none are due."""
        # Setup
        manager = PaymentRemindersEmailManager()
        
        with patch('app.service.payment_reminders_email_manager.CRUDPaymentReminder') as mock_crud_class:
            mock_crud = mock_crud_class.return_value
            mock_crud.get_due_today = AsyncMock(return_value=[])
            
            # Execute
            result = await manager.send_payment_reminders(db=mock_db_session)
            
            # Assertions
            assert result["success"] is True
            assert result["processed"] == 0
            assert result["sent"] == 0

    @pytest.mark.asyncio
    async def test_send_payment_reminders_with_reminders(self, mock_db_session, sample_reminder_model, sample_card_model):
        """Test sending reminders when reminders are due."""
        # Setup
        manager = PaymentRemindersEmailManager()
        sample_reminder_model.scheduled_date = date.today()
        
        with patch('app.service.payment_reminders_email_manager.CRUDPaymentReminder') as mock_crud_class:
            with patch('app.service.payment_reminders_email_manager.CRUDCreditCardInstructions') as mock_card_crud_class:
                with patch.object(manager, 'mailer') as mock_mailer:
                    # Setup mocks
                    mock_crud = mock_crud_class.return_value
                    mock_crud.get_due_today = AsyncMock(return_value=[sample_reminder_model])
                    mock_crud.mark_as_sent = AsyncMock(return_value=sample_reminder_model)
                    
                    mock_card_crud = mock_card_crud_class.return_value
                    mock_card_crud.get = AsyncMock(return_value=sample_card_model)
                    
                    mock_mailer.send_email = Mock(return_value={"message": "Email sent successfully"})
                    
                    # Execute
                    result = await manager.send_payment_reminders(db=mock_db_session)
                    
                    # Assertions
                    assert result["success"] is True
                    assert result["processed"] == 1

    def test_generate_email_subject_single_card(self):
        """Test email subject generation for single card."""
        manager = PaymentRemindersEmailManager()
        cards = [{
            "card_name": "Test Card",
            "days_until_due": 3,
            "urgency": "due-soon"
        }]
        
        subject = manager._generate_email_subject(cards)
        assert "Test Card" in subject
        assert "3 days remaining" in subject

    def test_generate_email_subject_multiple_cards(self):
        """Test email subject generation for multiple cards."""
        manager = PaymentRemindersEmailManager()
        cards = [
            {"card_name": "Card 1", "days_until_due": 1, "urgency": "urgent"},
            {"card_name": "Card 2", "days_until_due": 3, "urgency": "due-soon"}
        ]
        
        subject = manager._generate_email_subject(cards)
        assert "urgent credit card payment" in subject

    def test_generate_email_html_content(self):
        """Test HTML email content generation."""
        manager = PaymentRemindersEmailManager()
        cards = [{
            "card_name": "Test Card",
            "days_until_due": 3,
            "urgency": "due-soon",
            "due_date": date.today() + timedelta(days=3),
            "description": "Test card description"
        }]
        
        html_content = manager._generate_email_html(cards)
        
        # Assertions
        assert "Test Card" in html_content
        assert "Credit Card Payment Reminder" in html_content
        assert "3 day" in html_content
        assert "<!DOCTYPE html>" in html_content

    def test_group_reminders_by_user(self, sample_reminder_model):
        """Test grouping reminders by user."""
        manager = PaymentRemindersEmailManager()
        reminders = [sample_reminder_model]
        
        grouped = manager._group_reminders_by_user(reminders)
        
        assert TEST_USER_ID in grouped
        assert grouped[TEST_USER_ID]["email"] == TEST_EMAIL
        assert len(grouped[TEST_USER_ID]["reminders"]) == 1

    def test_is_configured_true(self):
        """Test email manager configuration check when properly configured."""
        manager = PaymentRemindersEmailManager()
        
        with patch.object(manager.mailer, 'is_configured', return_value=True):
            assert manager.is_configured() is True

    def test_is_configured_false(self):
        """Test email manager configuration check when not configured."""
        manager = PaymentRemindersEmailManager()
        
        with patch.object(manager.mailer, 'is_configured', return_value=False):
            assert manager.is_configured() is False


# Edge Cases and Error Handling Tests
class TestPaymentRemindersEdgeCases:
    """Test edge cases and error handling."""

    @pytest.mark.asyncio
    async def test_create_reminder_with_invalid_user_id(self, mock_db_session):
        """Test creating reminder with invalid user ID."""
        crud = CRUDPaymentReminder(mock_db_session)
        
        # Setup mock to raise IntegrityError
        from sqlalchemy.exc import IntegrityError
        mock_db_session.commit = AsyncMock(side_effect=IntegrityError("statement", "params", "orig"))
        mock_db_session.rollback = AsyncMock()
        
        invalid_reminder = PaymentReminderCreate(
            user_id=uuid4(),  # Non-existent user
            card_id=TEST_CARD_ID,
            scheduled_date=date.today(),
            email="test@example.com",
            days_before_due=3
        )
        
        # Execute and expect HTTPException
        with pytest.raises(Exception):  # Should raise HTTPException
            await crud.create(obj_in=invalid_reminder)

    def test_api_endpoint_with_invalid_uuid(self):
        """Test API endpoint with invalid UUID format."""
        # Execute
        response = client.get("/payment-reminders/?user_id=invalid-uuid")
        
        # Assertions
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_send_reminders_with_email_service_error(self, mock_db_session, sample_reminder_model):
        """Test sending reminders when email service fails."""
        manager = PaymentRemindersEmailManager()
        
        with patch('app.service.payment_reminders_email_manager.CRUDPaymentReminder') as mock_crud_class:
            with patch.object(manager, 'mailer') as mock_mailer:
                # Setup mocks
                mock_crud = mock_crud_class.return_value
                mock_crud.get_due_today = AsyncMock(return_value=[sample_reminder_model])
                mock_crud.mark_as_failed = AsyncMock(return_value=sample_reminder_model)
                
                mock_mailer.send_email = Mock(return_value={"error": "Email service unavailable"})
                
                # Execute
                result = await manager.send_payment_reminders(db=mock_db_session)
                
                # Assertions
                assert result["success"] is True
                assert result["failed"] == 1


# Performance Tests
class TestPaymentRemindersPerformance:
    """Test performance-related scenarios."""

    @pytest.mark.asyncio
    async def test_bulk_reminder_processing(self, mock_db_session):
        """Test processing large number of reminders."""
        manager = PaymentRemindersEmailManager()
        
        # Create 100 mock reminders
        reminders = []
        for i in range(100):
            reminder = Mock()
            reminder.id = uuid4()
            reminder.user_id = uuid4()
            reminder.card_id = uuid4()
            reminder.email = f"user{i}@example.com"
            reminder.scheduled_date = date.today()
            reminders.append(reminder)
        
        grouped = manager._group_reminders_by_user(reminders)
        
        # Assertions
        assert len(grouped) == 100  # Should group into 100 different users
        for user_reminders in grouped.values():
            assert len(user_reminders["reminders"]) == 1

    def test_email_html_generation_performance(self):
        """Test HTML generation with many cards."""
        manager = PaymentRemindersEmailManager()
        
        # Create 50 mock cards
        cards = []
        for i in range(50):
            cards.append({
                "card_name": f"Card {i}",
                "days_until_due": i % 7,
                "urgency": "urgent" if i % 7 <= 1 else "due-soon",
                "due_date": date.today() + timedelta(days=i % 7),
                "description": f"Description for card {i}"
            })
        
        html_content = manager._generate_email_html(cards)
        
        # Assertions
        assert len(html_content) > 1000  # Should generate substantial HTML
        # Allow for some variation in count (2 extra occurrences are acceptable)
        card_count = html_content.count("Card ")
        assert 50 <= card_count <= 52  # All cards should be included (with some tolerance)


if __name__ == "__main__":
    # Run specific test
    pytest.main([__file__, "-v"])
