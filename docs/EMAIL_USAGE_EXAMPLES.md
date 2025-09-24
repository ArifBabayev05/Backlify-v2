# Email Service Usage Examples

## Frontend Integration Examples

### 1. Contact Form

```html
<!DOCTYPE html>
<html>
<head>
    <title>Contact Form</title>
</head>
<body>
    <form id="contactForm">
        <input type="text" id="name" placeholder="Your Name" required>
        <input type="email" id="email" placeholder="Your Email" required>
        <input type="text" id="subject" placeholder="Subject" required>
        <textarea id="message" placeholder="Your Message" required></textarea>
        <input type="text" id="company" placeholder="Company (optional)">
        <input type="tel" id="phone" placeholder="Phone (optional)">
        <button type="submit">Send Message</button>
    </form>

    <script>
        document.getElementById('contactForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value,
                company: document.getElementById('company').value,
                phone: document.getElementById('phone').value
            };

            try {
                const response = await fetch('/api/email/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                
                if (result.success) {
                    alert('Message sent successfully!');
                    document.getElementById('contactForm').reset();
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                alert('Error sending message: ' + error.message);
            }
        });
    </script>
</body>
</html>
```

### 2. Support Request Form

```javascript
// Support request form handler
const submitSupportRequest = async (formData) => {
    try {
        const response = await fetch('/api/email/support', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: formData.email,
                subject: formData.subject,
                message: formData.message,
                priority: formData.priority || 'medium',
                category: formData.category || 'general',
                userId: getCurrentUserId() // Your user ID function
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Support request error:', error);
        throw error;
    }
};

// Usage
const supportData = {
    email: 'user@example.com',
    subject: 'Login Issues',
    message: 'I cannot log into my account. Getting error 500.',
    priority: 'high',
    category: 'authentication'
};

submitSupportRequest(supportData)
    .then(result => {
        if (result.success) {
            showSuccessMessage('Support request submitted successfully!');
        } else {
            showErrorMessage('Failed to submit support request: ' + result.message);
        }
    })
    .catch(error => {
        showErrorMessage('Error: ' + error.message);
    });
```

### 3. Feedback Form

```javascript
// Feedback form with rating
const submitFeedback = async (feedbackData) => {
    try {
        const response = await fetch('/api/email/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: feedbackData.email,
                subject: feedbackData.subject,
                message: feedbackData.message,
                rating: feedbackData.rating,
                category: feedbackData.category || 'general',
                userId: getCurrentUserId()
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Feedback submission error:', error);
        throw error;
    }
};

// Star rating component
const createStarRating = (containerId) => {
    const container = document.getElementById(containerId);
    let rating = 0;
    
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.innerHTML = '★';
        star.style.cursor = 'pointer';
        star.style.fontSize = '24px';
        star.style.color = '#ddd';
        
        star.addEventListener('click', () => {
            rating = i;
            updateStars();
        });
        
        star.addEventListener('mouseover', () => {
            highlightStars(i);
        });
        
        container.appendChild(star);
    }
    
    const updateStars = () => {
        const stars = container.querySelectorAll('span');
        stars.forEach((star, index) => {
            star.style.color = index < rating ? '#ffd700' : '#ddd';
        });
    };
    
    const highlightStars = (count) => {
        const stars = container.querySelectorAll('span');
        stars.forEach((star, index) => {
            star.style.color = index < count ? '#ffd700' : '#ddd';
        });
    };
    
    return () => rating;
};

// Usage
const getRating = createStarRating('rating-container');

document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const feedbackData = {
        email: document.getElementById('email').value,
        subject: document.getElementById('subject').value,
        message: document.getElementById('message').value,
        rating: getRating().toString(),
        category: document.getElementById('category').value
    };
    
    try {
        const result = await submitFeedback(feedbackData);
        if (result.success) {
            alert('Thank you for your feedback!');
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});
```

## Backend Integration Examples

### 1. User Registration Email

```javascript
// In your user registration controller
const emailService = require('../services/emailService');

const registerUser = async (req, res) => {
    try {
        // ... user registration logic ...
        
        // Send welcome email
        await emailService.sendEmail({
            subject: 'Welcome to Backlify!',
            message: `Welcome ${user.name}! Your account has been created successfully.`,
            fromEmail: 'noreply@backlify.app',
            fromName: 'Backlify Team',
            type: 'welcome',
            metadata: {
                userId: user.id,
                registrationDate: new Date().toISOString(),
                source: 'registration'
            }
        });
        
        res.json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
};
```

### 2. Payment Confirmation Email

```javascript
// In your payment controller
const emailService = require('../services/emailService');

const processPayment = async (req, res) => {
    try {
        // ... payment processing logic ...
        
        // Send payment confirmation
        await emailService.sendEmail({
            subject: 'Payment Confirmation',
            message: `Your payment of $${amount} has been processed successfully. Transaction ID: ${transactionId}`,
            fromEmail: 'payments@backlify.app',
            fromName: 'Backlify Payments',
            type: 'payment',
            metadata: {
                userId: user.id,
                amount: amount,
                transactionId: transactionId,
                plan: planName,
                paymentMethod: paymentMethod
            }
        });
        
        res.json({ success: true, message: 'Payment processed successfully' });
    } catch (error) {
        console.error('Payment error:', error);
        res.status(500).json({ error: 'Payment processing failed' });
    }
};
```

### 3. System Notification Email

```javascript
// System notification service
const emailService = require('../services/emailService');

const sendSystemNotification = async (notification) => {
    try {
        await emailService.sendEmail({
            subject: `System Alert: ${notification.title}`,
            message: notification.message,
            fromEmail: 'system@backlify.app',
            fromName: 'Backlify System',
            type: 'system',
            metadata: {
                severity: notification.severity,
                component: notification.component,
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV
            }
        });
        
        console.log('System notification sent successfully');
    } catch (error) {
        console.error('Failed to send system notification:', error);
    }
};

// Usage
const notification = {
    title: 'High Memory Usage',
    message: 'Server memory usage has exceeded 90%',
    severity: 'warning',
    component: 'server-monitor'
};

sendSystemNotification(notification);
```

### 4. API Usage Alert Email

```javascript
// API usage monitoring
const emailService = require('../services/emailService');

const checkApiUsage = async (userId) => {
    try {
        const usage = await getApiUsage(userId);
        const limit = await getUserLimit(userId);
        
        if (usage.requests >= limit.requests * 0.9) {
            // Send usage warning
            await emailService.sendEmail({
                subject: 'API Usage Warning',
                message: `You have used ${usage.requests} out of ${limit.requests} API requests this month. Please consider upgrading your plan.`,
                fromEmail: 'notifications@backlify.app',
                fromName: 'Backlify Notifications',
                type: 'usage',
                metadata: {
                    userId: userId,
                    currentUsage: usage.requests,
                    limit: limit.requests,
                    percentage: Math.round((usage.requests / limit.requests) * 100)
                }
            });
        }
    } catch (error) {
        console.error('API usage check error:', error);
    }
};
```

## React Component Examples

### 1. Contact Form Component

```jsx
import React, { useState } from 'react';

const ContactForm = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
        company: '',
        phone: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage('');

        try {
            const response = await fetch('/api/email/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                setMessage('Message sent successfully!');
                setFormData({
                    name: '',
                    email: '',
                    subject: '',
                    message: '',
                    company: '',
                    phone: ''
                });
            } else {
                setMessage('Error: ' + result.message);
            }
        } catch (error) {
            setMessage('Error: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="contact-form">
            <div className="form-group">
                <input
                    type="text"
                    name="name"
                    placeholder="Your Name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                />
            </div>
            
            <div className="form-group">
                <input
                    type="email"
                    name="email"
                    placeholder="Your Email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                />
            </div>
            
            <div className="form-group">
                <input
                    type="text"
                    name="subject"
                    placeholder="Subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                />
            </div>
            
            <div className="form-group">
                <textarea
                    name="message"
                    placeholder="Your Message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                />
            </div>
            
            <div className="form-group">
                <input
                    type="text"
                    name="company"
                    placeholder="Company (optional)"
                    value={formData.company}
                    onChange={handleChange}
                />
            </div>
            
            <div className="form-group">
                <input
                    type="tel"
                    name="phone"
                    placeholder="Phone (optional)"
                    value={formData.phone}
                    onChange={handleChange}
                />
            </div>
            
            <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
            
            {message && (
                <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}
        </form>
    );
};

export default ContactForm;
```

### 2. Support Request Hook

```jsx
import { useState } from 'react';

const useSupportRequest = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const submitSupportRequest = async (supportData) => {
        setIsSubmitting(true);
        setMessage('');

        try {
            const response = await fetch('/api/email/support', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(supportData)
            });

            const result = await response.json();

            if (result.success) {
                setMessage('Support request submitted successfully!');
                return { success: true, data: result };
            } else {
                setMessage('Error: ' + result.message);
                return { success: false, error: result.message };
            }
        } catch (error) {
            setMessage('Error: ' + error.message);
            return { success: false, error: error.message };
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        submitSupportRequest,
        isSubmitting,
        message
    };
};

export default useSupportRequest;
```

## Error Handling Best Practices

### 1. Client-Side Error Handling

```javascript
const handleEmailSubmission = async (emailData) => {
    try {
        const response = await fetch('/api/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Email sending failed');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error. Please check your connection.');
        }
        throw error;
    }
};
```

### 2. Retry Logic

```javascript
const sendEmailWithRetry = async (emailData, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await handleEmailSubmission(emailData);
            return result;
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Wait before retry (exponential backoff)
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};
```

### 3. Rate Limit Handling

```javascript
const handleRateLimit = (error) => {
    if (error.message.includes('Too many email requests')) {
        // Show user-friendly message
        showMessage('Please wait a few minutes before sending another email.', 'warning');
        
        // Disable form temporarily
        disableForm(15 * 60 * 1000); // 15 minutes
    }
};
```

These examples demonstrate how to integrate the email service into various parts of your application, from simple contact forms to complex system notifications.
