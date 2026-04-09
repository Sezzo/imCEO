import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Save, Bot, DollarSign, Gauge, Cpu, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

// Available AI Models
const AVAILABLE_MODELS = [
  { id: 'claude-opus-4', name: 'Claude Opus 4', provider: 'anthropic', description: 'Most capable model for complex tasks', maxTokens: 200000, costPer1K: 15.00 },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'anthropic', description: 'Balanced performance and cost', maxTokens: 200000, costPer1K: 3.00 },
  { id: 'claude-haiku-4', name: 'Claude Haiku 4', provider: 'anthropic', description: 'Fast and cost-effective', maxTokens: 200000, costPer1K: 0.25 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'OpenAI flagship model', maxTokens: 128000, costPer1K: 5.00 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Cost-optimized OpenAI model', maxTokens: 128000, costPer1K: 0.15 },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'google', description: 'Google multimodal model', maxTokens: 1000000, costPer1K: 0.50 },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

// Form schema
const modelProfileSchema = z.object({
  profileId: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  modelId: z.enum(['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-4', 'gpt-4o', 'gpt-4o-mini', 'gemini-pro']),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(200000).default(4096),
  topP: z.number().min(0).max(1).default(1),
  frequencyPenalty: z.number().min(-2).max(2).default(0),
  presencePenalty: z.number().min(-2).max(2).default(0),
  systemPrompt: z.string().max(10000, 'System prompt too long').optional(),
  reasoningBudget: z.number().min(0).max(32000).default(0),
  extendedThinking: z.boolean().default(false),
  responseFormat: z.enum(['text', 'json_object', 'json_schema']).default('text'),
  costLimitPerTask: z.number().min(0).optional(),
  costLimitPerDay: z.number().min(0).optional(),
  timeLimitPerTask: z.number().min(0).optional(),
  isDefault: z.boolean().default(false),
});

export type ModelProfileFormData = z.infer<typeof modelProfileSchema>;

export interface ModelProfile extends ModelProfileFormData {
  profileId: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

interface ModelProfileEditorProps {
  profile?: ModelProfile | null;
  companyId: string;
  onSave: (data: ModelProfileFormData) => void;
  onCancel: () => void;
}

export function ModelProfileEditor({ profile, companyId, onSave, onCancel }: ModelProfileEditorProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'cost'>('basic');
  const [estimatedCost, setEstimatedCost] = useState(0);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ModelProfileFormData>({
    resolver: zodResolver(modelProfileSchema),
    defaultValues: {
      name: '',
      description: '',
      modelId: 'claude-sonnet-4',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: '',
      reasoningBudget: 0,
      extendedThinking: false,
      responseFormat: 'text',
      costLimitPerTask: 1.00,
      costLimitPerDay: 10.00,
      timeLimitPerTask: 300,
      isDefault: false,
    },
  });

  const modelId = watch('modelId');
  const maxTokens = watch('maxTokens');
  const reasoningBudget = watch('reasoningBudget');

  useEffect(() => {
    if (profile) {
      setValue('name', profile.name);
      setValue('description', profile.description);
      setValue('modelId', profile.modelId);
      setValue('temperature', profile.temperature);
      setValue('maxTokens', profile.maxTokens);
      setValue('topP', profile.topP);
      setValue('frequencyPenalty', profile.frequencyPenalty);
      setValue('presencePenalty', profile.presencePenalty);
      setValue('systemPrompt', profile.systemPrompt);
      setValue('reasoningBudget', profile.reasoningBudget);
      setValue('extendedThinking', profile.extendedThinking);
      setValue('responseFormat', profile.responseFormat);
      setValue('costLimitPerTask', profile.costLimitPerTask);
      setValue('costLimitPerDay', profile.costLimitPerDay);
      setValue('timeLimitPerTask', profile.timeLimitPerTask);
      setValue('isDefault', profile.isDefault);
    }
  }, [profile, setValue]);

  // Calculate estimated cost
  useEffect(() => {
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    if (model) {
      const cost = (maxTokens / 1000) * model.costPer1K;
      setEstimatedCost(cost);
    }
  }, [modelId, maxTokens]);

  const selectedModel = AVAILABLE_MODELS.find(m => m.id === modelId);

  const onSubmit = (data: ModelProfileFormData) => {
    onSave(data);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Bot className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {profile ? 'Edit Model Profile' : 'Create Model Profile'}
            </h2>
            <p className="text-sm text-gray-500">Configure AI model settings and cost limits</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-gray-200">
        <div className="flex gap-1">
          {(['basic', 'advanced', 'cost'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Basic Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* Name & Description */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profile Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    className={clsx(
                      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                      errors.name ? 'border-red-300' : 'border-gray-300'
                    )}
                    placeholder="e.g., Code Review Assistant"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    {...register('description')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Brief description of this profile's purpose..."
                  />
                </div>
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  AI Model
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {AVAILABLE_MODELS.map((model) => (
                    <label
                      key={model.id}
                      className={clsx(
                        'relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all',
                        modelId === model.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      )}
                    >
                      <input
                        type="radio"
                        {...register('modelId')}
                        value={model.id}
                        className="sr-only"
                      />
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className={clsx(
                            'w-4 h-4',
                            model.provider === 'anthropic' ? 'text-orange-500' :
                            model.provider === 'openai' ? 'text-green-500' : 'text-blue-500'
                          )} />
                          <span className="font-medium text-sm">{model.name}</span>
                        </div>
                        {modelId === model.id && (
                          <CheckCircle className="w-5 h-5 text-purple-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{model.description}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{model.maxTokens.toLocaleString()} tokens</span>
                        <span className="font-medium text-purple-600">${model.costPer1K}/1K</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  System Prompt
                </label>
                <textarea
                  {...register('systemPrompt')}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter system instructions for the AI..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  Define the AI's behavior, tone, and constraints
                </p>
              </div>

              {/* Default Checkbox */}
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('isDefault')}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-sm text-gray-900">Set as Default Profile</span>
                  <p className="text-xs text-gray-500">Use this profile for new agents unless specified otherwise</p>
                </div>
              </label>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Temperature</label>
                  <span className="text-sm text-gray-500">{watch('temperature')}</span>
                </div>
                <Controller
                  name="temperature"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  )}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Precise (0)</span>
                  <span>Balanced (1)</span>
                  <span>Creative (2)</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Tokens
                </label>
                <input
                  type="number"
                  {...register('maxTokens', { valueAsNumber: true })}
                  min={1}
                  max={selectedModel?.maxTokens || 200000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Maximum: {selectedModel?.maxTokens.toLocaleString()} tokens
                </p>
              </div>

              {/* Reasoning Budget (for Claude) */}
              {modelId.startsWith('claude-') && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      Reasoning Budget
                    </label>
                    <span className="text-sm text-gray-500">{reasoningBudget} tokens</span>
                  </div>
                  <Controller
                    name="reasoningBudget"
                    control={control}
                    render={({ field }) => (
                      <input
                        type="range"
                        min="0"
                        max="32000"
                        step="1000"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                    )}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Allocates tokens for extended thinking and reasoning
                  </p>
                </div>
              )}

              {/* Extended Thinking */}
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('extendedThinking')}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-sm text-gray-900">Extended Thinking</span>
                  <p className="text-xs text-gray-500">Enable step-by-step reasoning for complex tasks</p>
                </div>
              </label>

              {/* Response Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Response Format
                </label>
                <div className="flex gap-3">
                  {(['text', 'json_object', 'json_schema'] as const).map((format) => (
                    <label
                      key={format}
                      className={clsx(
                        'flex-1 flex items-center justify-center px-4 py-2 border rounded-lg cursor-pointer transition-all',
                        watch('responseFormat') === format
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <input
                        type="radio"
                        {...register('responseFormat')}
                        value={format}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium capitalize">
                        {format.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Advanced Parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Top P</label>
                  <input
                    type="number"
                    {...register('topP', { valueAsNumber: true })}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency Penalty</label>
                  <input
                    type="number"
                    {...register('frequencyPenalty', { valueAsNumber: true })}
                    min={-2}
                    max={2}
                    step={0.1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Cost Tab */}
          {activeTab === 'cost' && (
            <div className="space-y-6">
              {/* Cost Estimate Card */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <h3 className="font-medium text-gray-900">Cost Estimation</h3>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-green-700">${estimatedCost.toFixed(4)}</span>
                  <span className="text-sm text-gray-500">per request (estimated)</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Based on max tokens ({maxTokens.toLocaleString()}) × model rate
                </p>
              </div>

              {/* Cost Limits */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Cost Limit Per Task ($)
                  </label>
                  <input
                    type="number"
                    {...register('costLimitPerTask', { valueAsNumber: true })}
                    min={0}
                    step={0.01}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="1.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum cost allowed for a single task
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Cost Limit ($)
                  </label>
                  <input
                    type="number"
                    {...register('costLimitPerDay', { valueAsNumber: true })}
                    min={0}
                    step={0.01}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="10.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum cumulative cost per day for this profile
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-blue-500" />
                    Time Limit Per Task (seconds)
                  </label>
                  <input
                    type="number"
                    {...register('timeLimitPerTask', { valueAsNumber: true })}
                    min={0}
                    step={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="300"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum execution time for tasks using this profile
                  </p>
                </div>
              </div>

              {/* Cost Alerts */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-medium text-amber-800 text-sm mb-2">Cost Control Tips</h4>
                <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                  <li>Set lower limits for experimental or high-volume tasks</li>
                  <li>Use smaller models (Haiku/Mini) for simple operations</li>
                  <li>Enable cost alerts in notification settings</li>
                  <li>Monitor daily usage in the Cost Dashboard</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {isDirty ? 'Unsaved changes' : 'All changes saved'}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={!isDirty || isSubmitting}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              isDirty && !isSubmitting
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
