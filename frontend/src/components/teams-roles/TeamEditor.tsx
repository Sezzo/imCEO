import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Team } from './TeamsList';

const teamSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(100, 'Name darf maximal 100 Zeichen haben'),
  department_id: z.string().min(1, 'Department ist erforderlich'),
  description: z
    .string()
    .max(500, 'Beschreibung darf maximal 500 Zeichen haben')
    .optional(),
  mission: z
    .string()
    .max(500, 'Mission darf maximal 500 Zeichen haben')
    .optional(),
  team_type: z.string().min(1, 'Team-Typ ist erforderlich'),
  lead_role_id: z.string().optional(),
});

type TeamFormData = z.infer<typeof teamSchema>;

interface TeamEditorProps {
  team?: Team | null;
  departments: { department_id: string; name: string }[];
  roles: { role_template_id: string; name: string }[];
  teamTypes: string[];
  onSave: (data: TeamFormData, teamId?: string) => void;
  onCancel: () => void;
}

export function TeamEditor({
  team,
  departments,
  roles,
  teamTypes,
  onSave,
  onCancel,
}: TeamEditorProps) {
  const isEditing = !!team;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      department_id: '',
      description: '',
      mission: '',
      team_type: '',
      lead_role_id: '',
    },
  });

  useEffect(() => {
    if (team) {
      reset({
        name: team.name,
        department_id: team.department_id,
        description: team.description,
        mission: team.mission,
        team_type: team.team_type,
        lead_role_id: team.lead_role_id || '',
      });
    } else {
      reset({
        name: '',
        department_id: '',
        description: '',
        mission: '',
        team_type: '',
        lead_role_id: '',
      });
    }
  }, [team, reset]);

  const onSubmit = (data: TeamFormData) => {
    onSave(data, team?.team_id);
  };

  return (
    <div className="team-editor">
      <div className="editor-header">
        <h2>{isEditing ? 'Team bearbeiten' : 'Neues Team erstellen'}</h2>
        <button className="btn-close" onClick={onCancel}>
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="editor-form">
        <div className="form-group">
          <label htmlFor="name">
            Name <span className="required">*</span>
          </label>
          <input
            id="name"
            type="text"
            {...register('name')}
            className={errors.name ? 'error' : ''}
            placeholder="z.B. Frontend Team"
          />
          {errors.name && (
            <span className="error-message">{errors.name.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="department_id">
            Department <span className="required">*</span>
          </label>
          <select
            id="department_id"
            {...register('department_id')}
            className={errors.department_id ? 'error' : ''}
          >
            <option value="">Bitte wählen...</option>
            {departments.map((dept) => (
              <option key={dept.department_id} value={dept.department_id}>
                {dept.name}
              </option>
            ))}
          </select>
          {errors.department_id && (
            <span className="error-message">{errors.department_id.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="team_type">
            Team-Typ <span className="required">*</span>
          </label>
          <select
            id="team_type"
            {...register('team_type')}
            className={errors.team_type ? 'error' : ''}
          >
            <option value="">Bitte wählen...</option>
            {teamTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.team_type && (
            <span className="error-message">{errors.team_type.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="lead_role_id">Team Lead (Rolle)</label>
          <select id="lead_role_id" {...register('lead_role_id')}>
            <option value="">Kein Lead zugewiesen</option>
            {roles.map((role) => (
              <option key={role.role_template_id} value={role.role_template_id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description">Beschreibung</label>
          <textarea
            id="description"
            {...register('description')}
            rows={3}
            className={errors.description ? 'error' : ''}
            placeholder="Kurze Beschreibung des Teams..."
          />
          {errors.description && (
            <span className="error-message">{errors.description.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="mission">Mission</label>
          <textarea
            id="mission"
            {...register('mission')}
            rows={3}
            className={errors.mission ? 'error' : ''}
            placeholder="Die Mission dieses Teams..."
          />
          {errors.mission && (
            <span className="error-message">{errors.mission.message}</span>
          )}
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
                : 'Team erstellen'}
          </button>
        </div>
      </form>
    </div>
  );
}
