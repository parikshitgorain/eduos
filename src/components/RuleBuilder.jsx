/**
 * Rule Builder Component
 * Visual condition editor for academic policy rules
 */

import React, { useState } from 'react';

const RULE_TYPES = {
  ATTENDANCE_THRESHOLD: 'attendance_threshold',
  GRADE_ELIGIBILITY: 'grade_eligibility',
  GRACE_MARKS: 'grace_marks'
};

const OPERATORS = ['>=', '<=', '>', '<', '==', '!=', 'in', 'not_in'];

const ACTION_TYPES = {
  SET_ELIGIBILITY: 'set_eligibility',
  APPLY_GRACE_MARKS: 'apply_grace_marks',
  SEND_NOTIFICATION: 'send_notification',
  BLOCK_ENROLLMENT: 'block_enrollment'
};

const FIELD_OPTIONS = {
  attendance_threshold: [
    { value: 'attendance_percentage', label: 'Attendance Percentage' },
    { value: 'total_classes', label: 'Total Classes' },
    { value: 'present_count', label: 'Present Count' }
  ],
  grade_eligibility: [
    { value: 'grade_average', label: 'Grade Average' },
    { value: 'score', label: 'Score' },
    { value: 'credits_earned', label: 'Credits Earned' }
  ],
  grace_marks: [
    { value: 'score', label: 'Score' },
    { value: 'grade', label: 'Grade' }
  ]
};

export default function RuleBuilder({ onSave, initialRule = null }) {
  const [ruleName, setRuleName] = useState(initialRule?.name || '');
  const [ruleType, setRuleType] = useState(initialRule?.type || RULE_TYPES.ATTENDANCE_THRESHOLD);
  const [conditions, setConditions] = useState(initialRule?.conditions || [
    { field: '', operator: '>=', value: '' }
  ]);
  const [actions, setActions] = useState(initialRule?.actions || [
    { type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }
  ]);
  const [priority, setPriority] = useState(initialRule?.priority || 100);
  const [effectiveFrom, setEffectiveFrom] = useState(initialRule?.effective_from || '');
  const [effectiveUntil, setEffectiveUntil] = useState(initialRule?.effective_until || '');
  const [errors, setErrors] = useState({});

  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: '>=', value: '' }]);
  };

  const removeCondition = (index) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index, field, value) => {
    const newConditions = [...conditions];
    newConditions[index][field] = value;
    setConditions(newConditions);
  };

  const addAction = () => {
    setActions([...actions, { type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]);
  };

  const removeAction = (index) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index, field, value) => {
    const newActions = [...actions];
    newActions[index][field] = value;
    setActions(newActions);
  };

  const validateRule = () => {
    const newErrors = {};

    if (!ruleName.trim()) {
      newErrors.ruleName = 'Rule name is required';
    }

    if (conditions.some(c => !c.field || c.value === '')) {
      newErrors.conditions = 'All conditions must have a field and value';
    }

    if (effectiveFrom && effectiveUntil && new Date(effectiveFrom) >= new Date(effectiveUntil)) {
      newErrors.dates = 'Effective from date must be before effective until date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateRule()) {
      return;
    }

    const rule = {
      name: ruleName,
      type: ruleType,
      conditions: conditions.map(c => ({
        field: c.field,
        operator: c.operator,
        value: parseFloat(c.value) || c.value
      })),
      actions,
      priority: parseInt(priority),
      effective_from: effectiveFrom || undefined,
      effective_until: effectiveUntil || undefined
    };

    try {
      await onSave(rule);
    } catch (error) {
      setErrors({ submit: error.message });
    }
  };

  const renderActionFields = (action, index) => {
    switch (action.type) {
      case ACTION_TYPES.SET_ELIGIBILITY:
        return (
          <div className="action-field">
            <label>
              <input
                type="checkbox"
                checked={action.eligible || false}
                onChange={(e) => updateAction(index, 'eligible', e.target.checked)}
              />
              Set Eligible
            </label>
            <input
              type="text"
              placeholder="Reason"
              value={action.reason || ''}
              onChange={(e) => updateAction(index, 'reason', e.target.value)}
              className="input-field"
            />
          </div>
        );

      case ACTION_TYPES.APPLY_GRACE_MARKS:
        return (
          <div className="action-field">
            <input
              type="number"
              placeholder="Marks"
              value={action.marks || ''}
              onChange={(e) => updateAction(index, 'marks', parseFloat(e.target.value))}
              className="input-field"
            />
            <input
              type="number"
              placeholder="Max Marks"
              value={action.max_marks || ''}
              onChange={(e) => updateAction(index, 'max_marks', parseFloat(e.target.value))}
              className="input-field"
            />
          </div>
        );

      case ACTION_TYPES.SEND_NOTIFICATION:
        return (
          <div className="action-field">
            <textarea
              placeholder="Notification Message"
              value={action.message || ''}
              onChange={(e) => updateAction(index, 'message', e.target.value)}
              className="input-field"
              rows="3"
            />
          </div>
        );

      case ACTION_TYPES.BLOCK_ENROLLMENT:
        return (
          <div className="action-field">
            <input
              type="text"
              placeholder="Reason for blocking"
              value={action.reason || ''}
              onChange={(e) => updateAction(index, 'reason', e.target.value)}
              className="input-field"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="rule-builder">
      <h2>Academic Rule Builder</h2>

      {errors.submit && (
        <div className="error-message">{errors.submit}</div>
      )}

      <div className="form-section">
        <label>Rule Name *</label>
        <input
          type="text"
          value={ruleName}
          onChange={(e) => setRuleName(e.target.value)}
          className="input-field"
          placeholder="e.g., Minimum 75% Attendance"
        />
        {errors.ruleName && <span className="error">{errors.ruleName}</span>}
      </div>

      <div className="form-section">
        <label>Rule Type *</label>
        <select
          value={ruleType}
          onChange={(e) => setRuleType(e.target.value)}
          className="input-field"
        >
          <option value={RULE_TYPES.ATTENDANCE_THRESHOLD}>Attendance Threshold</option>
          <option value={RULE_TYPES.GRADE_ELIGIBILITY}>Grade Eligibility</option>
          <option value={RULE_TYPES.GRACE_MARKS}>Grace Marks</option>
        </select>
      </div>

      <div className="form-section">
        <label>Conditions *</label>
        {conditions.map((condition, index) => (
          <div key={index} className="condition-row">
            <select
              value={condition.field}
              onChange={(e) => updateCondition(index, 'field', e.target.value)}
              className="input-field"
            >
              <option value="">Select Field</option>
              {FIELD_OPTIONS[ruleType]?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={condition.operator}
              onChange={(e) => updateCondition(index, 'operator', e.target.value)}
              className="input-field"
            >
              {OPERATORS.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>

            <input
              type="text"
              value={condition.value}
              onChange={(e) => updateCondition(index, 'value', e.target.value)}
              placeholder="Value"
              className="input-field"
            />

            <button
              type="button"
              onClick={() => removeCondition(index)}
              className="btn-remove"
              disabled={conditions.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
        {errors.conditions && <span className="error">{errors.conditions}</span>}
        <button type="button" onClick={addCondition} className="btn-add">
          + Add Condition
        </button>
      </div>

      <div className="form-section">
        <label>Actions *</label>
        {actions.map((action, index) => (
          <div key={index} className="action-row">
            <select
              value={action.type}
              onChange={(e) => updateAction(index, 'type', e.target.value)}
              className="input-field"
            >
              <option value={ACTION_TYPES.SET_ELIGIBILITY}>Set Eligibility</option>
              <option value={ACTION_TYPES.APPLY_GRACE_MARKS}>Apply Grace Marks</option>
              <option value={ACTION_TYPES.SEND_NOTIFICATION}>Send Notification</option>
              <option value={ACTION_TYPES.BLOCK_ENROLLMENT}>Block Enrollment</option>
            </select>

            {renderActionFields(action, index)}

            <button
              type="button"
              onClick={() => removeAction(index)}
              className="btn-remove"
              disabled={actions.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addAction} className="btn-add">
          + Add Action
        </button>
      </div>

      <div className="form-section">
        <label>Priority</label>
        <input
          type="number"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="input-field"
          placeholder="100"
        />
        <small>Higher priority rules are evaluated first</small>
      </div>

      <div className="form-section">
        <label>Effective From</label>
        <input
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          className="input-field"
        />
      </div>

      <div className="form-section">
        <label>Effective Until</label>
        <input
          type="date"
          value={effectiveUntil}
          onChange={(e) => setEffectiveUntil(e.target.value)}
          className="input-field"
        />
        {errors.dates && <span className="error">{errors.dates}</span>}
      </div>

      <div className="form-actions">
        <button type="button" onClick={handleSave} className="btn-primary">
          Save Rule
        </button>
      </div>

      <style jsx>{`
        .rule-builder {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .form-section {
          margin-bottom: 20px;
        }

        .form-section label {
          display: block;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .input-field {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .condition-row,
        .action-row {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
          align-items: flex-start;
        }

        .condition-row .input-field,
        .action-row .input-field {
          flex: 1;
        }

        .action-field {
          flex: 1;
          display: flex;
          gap: 10px;
          flex-direction: column;
        }

        .btn-add,
        .btn-remove {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .btn-add {
          background-color: #4CAF50;
          color: white;
        }

        .btn-remove {
          background-color: #f44336;
          color: white;
        }

        .btn-remove:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .btn-primary {
          background-color: #2196F3;
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }

        .error {
          color: #f44336;
          font-size: 12px;
          display: block;
          margin-top: 5px;
        }

        .error-message {
          background-color: #ffebee;
          color: #c62828;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        small {
          color: #666;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
