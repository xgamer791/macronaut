/** OpenAI/xAI chat-completions tool definitions for the Macronaut voice agent. */

export type AssistantToolDef = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const dateProp = {
  type: 'string',
  description:
    'Day as YYYY-MM-DD, or relative: today, yesterday, tomorrow, N days ago, last monday, July 4. Omit to use the day currently selected in the app UI.',
};

export const ASSISTANT_TOOLS: AssistantToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'get_day_summary',
      description:
        'Get calories, macros, burned exercise, remaining calories, and goals for a day. ALWAYS call this after logging food if the user asks about remaining calories. Use for any historical day.',
      parameters: { type: 'object', properties: { date: dateProp } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_diary_entries',
      description: 'List foods logged on a day (name, meal, calories, macros, ids).',
      parameters: { type: 'object', properties: { date: dateProp } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_diary_entries',
      description:
        'Search diary foods by name snippet across a date range. Use before deleting/updating when the user names a food.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Food name snippet (case-insensitive)' },
          date: dateProp,
          days_back: { type: 'number', description: 'Search window if date omitted (default 14)' },
          meal: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snacks'],
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_meal',
      description:
        'Log a food/meal. Estimate nutrition if needed and say you estimated. Echo the resolved date and meal in your spoken reply.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          fiber: { type: 'number' },
          meal: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snacks'],
          },
          date: dateProp,
          notes: { type: 'string' },
          serving_desc: { type: 'string' },
        },
        required: ['name', 'calories'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_diary_entry',
      description: 'Update a logged food by id.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          meal: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snacks'] },
          notes: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_diary_entry',
      description:
        'Delete a diary food. Prefer `contains` (food name snippet). If multiple match, the tool returns candidates — ask the user which one, do NOT guess.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          contains: { type: 'string', description: 'Food name snippet' },
          date: dateProp,
          meal: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snacks'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_diary_entries',
      description: 'Delete diary foods by exact ids (only when ids are known and unique).',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_notes',
      description: 'List day notes for a specific date.',
      parameters: { type: 'object', properties: { date: dateProp } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_notes',
      description: 'Search notes across a date range by keyword.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          from: dateProp,
          to: dateProp,
          days_back: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_note',
      description:
        'Create a day note. For "make a note of that", pass body "that" (uses previous answer).',
      parameters: {
        type: 'object',
        properties: {
          body: { type: 'string' },
          date: dateProp,
        },
        required: ['body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_note',
      description: 'Update an existing note body by id.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['id', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_note',
      description:
        'Delete a note by id or contains=snippet. If multiple match, returns candidates — ask which one; never guess.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          contains: { type: 'string' },
          date: dateProp,
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_activities',
      description: 'List exercise entries for a day.',
      parameters: { type: 'object', properties: { date: dateProp } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_activity',
      description: 'Log exercise that burns calories.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          calories_burned: { type: 'number' },
          activity_type: {
            type: 'string',
            enum: ['cardio', 'strength', 'sports', 'mobility', 'other'],
          },
          duration_min: { type: 'number' },
          intensity: { type: 'string', enum: ['easy', 'moderate', 'hard'] },
          date: dateProp,
          notes: { type: 'string' },
        },
        required: ['name', 'calories_burned'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_activity',
      description: 'Delete an activity by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_recent_foods',
      description: 'Recently logged foods.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_goals',
      description: 'Get calorie/macro targets for a day.',
      parameters: { type: 'object', properties: { date: dateProp } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description:
        'Ask the user a short clarifying question when the request is ambiguous (which note/meal/date). Your final spoken reply should be this question — do not mutate until they answer.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'One short spoken clarifying question' },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'undo_last_action',
      description:
        'Undo the most recent add/delete the agent performed (meal, note, or activity). Use when the user says undo / reverse that.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember_fact',
      description: 'Pin a durable preference/fact.',
      parameters: {
        type: 'object',
        properties: { fact: { type: 'string' } },
        required: ['fact'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forget_fact',
      description: 'Remove a pinned fact matching a snippet.',
      parameters: {
        type: 'object',
        properties: { contains: { type: 'string' } },
        required: ['contains'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recall_memory',
      description: 'Recall pinned facts, last answer, and whether undo is available.',
      parameters: { type: 'object', properties: {} },
    },
  },
];
