import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HIERARCHY_LEVELS, type HierarchyLevel } from './RoleTemplateList';
import type { RoleTemplate } from './RoleTemplateList';

const roleTemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(100, 'Name darf maximal 100 Zeichen haben'),
  hierarchy_level: z.enum(HIERARCHY_LEVELS, {
    errorMap: () => ({ message: 'Hierarchie-Ebene ist erforderlich' }),
  }),
  description: z
    .string()
    .max(500, 'Beschreibung darf maximal 500 Zeichen haben')
    .optional(),
  purpose: z
    .string()
    .max(500, 'Zweck darf maximal 500 Zeichen haben')
    .optional(),
  decision_scope: z
    .string()
    .max(1000, 'Entscheidungsbereich darf maximal 1000 Zeichen haben')
    .optional(),
  escalation_scope: z
    .string()
    .max(1000, 'Eskalationsbereich darf maximal 1000 Zeichen haben')
    .optional(),
  primary_responsibilities: z
    .array(
      z.object({
        value: z.string().min(1, 'Verantwortlichkeit darf nicht leer sein'),
      })
    )
    .default([]),
  non_responsibilities: z
    .array(
      z.object({
        value: z.string().min(1, 'Nicht-Verantwortlichkeit darf nicht leer sein'),
      })
    )
    .default([]),
});

type RoleTemplateFormData = z.infer<typeof roleTemplateSchema>;

interface RoleTemplateEditorProps {
  roleTemplate?: RoleTemplate | null;
  onSave: (data: RoleTemplateFormData, roleId?: string) => void;
  onCancel: () => void;
}

export function RoleTemplateEditor({
  roleTemplate,
  onSave,
  onCancel,
}: RoleTemplateEditorProps) {
  const isEditing = !!roleTemplate;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<RoleTemplateFormData>({
    resolver: zodResolver(roleTemplateSchema),
    defaultValues: {
      name: '',
      hierarchy_level: 'Specialist',
      description: '',
      purpose: '',
      decision_scope: '',
      escalation_scope: '',
      primary_responsibilities: [],
      non_responsibilities: [],
    },
  });

  const {
    fields: responsibilityFields,
    append: appendResponsibility,
    remove: removeResponsibility,
  } = useFieldArray({
    control,
    name: 'primary_responsibilities',
  });

  const {
    fields: nonResponsibilityFields,
    append: appendNonResponsibility,
    remove: removeNonResponsibility,
  } = useFieldArray({
    control,
    name: 'non_responsibilities',
  });

  useEffect(() => {
    if (roleTemplate) {
      reset({
        name: roleTemplate.name,
        hierarchy_level: roleTemplate.hierarchy_level,
        description: roleTemplate.description,
        purpose: roleTemplate.purpose,
        decision_scope: roleTemplate.decision_scope,
        escalation_scope: roleTemplate.escalation_scope,
        primary_responsibilities: roleTemplate.primary_responsibilities.map(
          (r) => ({ value: r })
        ),
        non_responsibilities: roleTemplate.non_responsibilities.map((r) => ({
          value: r,
        })),
      });
    } else {
      reset({
        name: '',
        hierarchy_level: 'Specialist',
        description: '',
        purpose: '',
        decision_scope: '',
        escalation_scope: '',
        primary_responsibilities: [],
        non_responsibilities: [],
      });
    }
  }, [roleTemplate, reset]);

  const onSubmit = (data: RoleTemplateFormData) => {
    const formattedData = {
      ...data,
      primary_responsibilities: data.primary_responsibilities.map((r) => r.value),
      non_responsibilities: data.non_responsibilities.map((r) => r.value),
    };
    onSave(formattedData as RoleTemplateFormData, roleTemplate?.role_template_id);
  };

  const getHierarchyColor = (level: HierarchyLevel) => {
    const colors: Record<HierarchyLevel, string> = {
      CEO: '#d4af37',
      Executive: '#c0392b',
      Management: '#8e44ad',
      Lead: '#2980b9',
      Specialist: '#27ae60',
      Governance: '#f39c12',
      Observer: '#7f8c8d',
    };
    return colors[level];
  };

  return (
    <div className="role-template-editor">
      <div className="editor-header">
        <h2>
          {isEditing ? 'Rollen-Template bearbeiten' : 'Neues Rollen-Template erstellen'}
        </h2>
        <button className="btn-close" onClick={onCancel}>
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="editor-form">
        <div className="form-row">
          <div className="form-group form-group-large">
            <label htmlFor="name">
              Name <span className="required">*</span>
            </label>
            <input
              id="name"
              type="text"
              {...register('name')}
              className={errors.name ? 'error' : ''}
              placeholder="z.B. Senior Frontend Engineer"
            />
            {errors.name && (
              <span className="error-message">{errors.name.message}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="hierarchy_level">
              Hierarchie-Ebene <span className="required">*</span>
            </label>
            <select
              id="hierarchy_level"
              {...register('hierarchy_level')}
              className={errors.hierarchy_level ? 'error' : ''}
              style={{
                borderLeftWidth: '4px',
                borderLeftColor: getHierarchyColor(
                  (document.getElementById('hierarchy_level') as HTMLSelectElement)
                    ?.value as HierarchyLevel || 'Specialist'
                ),
              }}
            >
              {HIERARCHY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            {errors.hierarchy_level && (
              <span className="error-message">
                {errors.hierarchy_level.message}
              </span>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Beschreibung</label>
          <textarea
            id="description"
            {...register('description')}
            rows={3}
            className={errors.description ? 'error' : ''}
            placeholder="Kurze Beschreibung der Rolle..."
          />
          {errors.description && (
            <span className="error-message">{errors.description.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="purpose">Zweck / Purpose</label>
          <textarea
            id="purpose"
            {...register('purpose')}
            rows={3}
            className={errors.purpose ? 'error' : ''}
            placeholder="Warum existiert diese Rolle? Welchen Beitrag leistet sie?"
          />
          {errors.purpose && (
            <span className="error-message">{errors.purpose.message}</span>
          )}
        </div>

        <div className="form-section">
          <h3>Verantwortlichkeiten</h3>
          <div className="field-array">
            {responsibilityFields.map((field, index) => (
              <div key={field.id} className="field-array-item">
                <input
                  type="text"
                  {...register(`primary_responsibilities.${index}.value`)}
                  placeholder={`Verantwortlichkeit ${index + 1}`}
                  className={
                    errors.primary_responsibilities?.[index] ? 'error' : ''
                  }
                />
                <button
                  type="button"
                  className="btn-icon-remove"
                  onClick={() => removeResponsibility(index)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-add-item"
              onClick={() => appendResponsibility({ value: '' })}
            >
              + Verantwortlichkeit hinzufügen
            </button>
          </div>
        </div>

        <div className="form-section">
          <h3>Nicht-Verantwortlichkeiten (Grenzen)</h3>
          <div className="field-array">
            {nonResponsibilityFields.map((field, index) => (
              <div key={field.id} className="field-array-item">
                <input
                  type="text"
                  {...register(`non_responsibilities.${index}.value`)}
                  placeholder={`Nicht-Verantwortlichkeit ${index + 1}`}
                  className={
                    errors.non_responsibilities?.[index] ? 'error' : ''
                  }
                />
                <button
                  type="button"
                  className="btn-icon-remove"
                  onClick={() => removeNonResponsibility(index)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-add-item"
              onClick={() => appendNonResponsibility({ value: '' })}
            >
              + Nicht-Verantwortlichkeit hinzufügen
            </button>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="decision_scope">Entscheidungsbereich</label>
            <textarea
              id="decision_scope"
              {...register('decision_scope')}
              rows={4}
              className={errors.decision_scope ? 'error' : ''}
              placeholder="Welche Entscheidungen darf diese Rolle treffen?"
            />
            {errors.decision_scope && (
              <span className="error-message">
                {errors.decision_scope.message}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="escalation_scope">Eskalationsbereich</label>
            <textarea
              id="escalation_scope"
              {...register('escalation_scope')}
              rows={4}
              className={errors.escalation_scope ? 'error' : ''}
              placeholder="Wann und an wen muss diese Rolle eskalieren?"
            />
            {errors.escalation_scope && (
              <span className="error-message">
                {errors.escalation_scope.message}
              </span>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!isDirty || isSubmitting}
          >
            {isSubmitting
              ? 'Speichern...'
              : isEditing
                ? 'Änderungen speichern'
                : 'Rolle erstellen'}
          </button>
        </div>
      </form>
    </div>
  );
}
