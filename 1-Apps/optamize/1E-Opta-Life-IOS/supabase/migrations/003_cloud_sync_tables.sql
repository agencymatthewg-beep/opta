-- ============================================================
-- Opta Life — Cloud Sync Tables Migration
-- Adds tasks, habits, journal, calendar_events for cloud sync
-- Run in: Supabase Dashboard → SQL Editor
-- Created: 2026-02-25 by Opta512
-- ============================================================

-- ============================================================
-- 1. TASKS TABLE (Todoist mirror + Opta native)
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Core fields
    title TEXT NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 4),
    due_date TIMESTAMPTZ,
    
    -- Sync metadata
    source VARCHAR(50) DEFAULT 'opta',
    external_id VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    client_updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, external_id, source)
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own tasks"
    ON tasks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(user_id, due_date) WHERE NOT is_completed;

-- ============================================================
-- 2. HABITS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS habits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color VARCHAR(20),
    frequency VARCHAR(20) DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'custom')),
    target_days INTEGER[] DEFAULT '{1,2,3,4,5,6,7}',
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_completions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(habit_id, completed_date)
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own habits"
    ON habits FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their own habit completions"
    ON habit_completions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS habits_user_id_idx ON habits(user_id);
CREATE INDEX IF NOT EXISTS habit_completions_habit_idx ON habit_completions(habit_id, completed_date);

-- ============================================================
-- 3. JOURNAL TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS journal (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT NOT NULL,
    mood INTEGER CHECK (mood BETWEEN 1 AND 5),
    mood_label VARCHAR(50),
    tags TEXT[] DEFAULT '{}',
    ai_summary TEXT,
    ai_sentiment VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    entry_date DATE DEFAULT CURRENT_DATE,
    client_updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own journal entries"
    ON journal FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS journal_user_date_idx ON journal(user_id, entry_date DESC);

-- ============================================================
-- 4. CALENDAR EVENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    timezone VARCHAR(100) DEFAULT 'UTC',
    source VARCHAR(50) DEFAULT 'opta',
    external_id VARCHAR(500),
    calendar_id VARCHAR(500),
    calendar_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    client_updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, external_id, source)
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own calendar events"
    ON calendar_events FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS calendar_events_user_time_idx ON calendar_events(user_id, start_time);

-- ============================================================
-- 5. AUTO-UPDATE TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_habits_updated_at ON habits;
CREATE TRIGGER update_habits_updated_at
    BEFORE UPDATE ON habits
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_journal_updated_at ON journal;
CREATE TRIGGER update_journal_updated_at
    BEFORE UPDATE ON journal
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 6. ENABLE REALTIME
-- ============================================================

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE tasks; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'tasks realtime: %', SQLERRM; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE habits; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'habits realtime: %', SQLERRM; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE journal; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'journal realtime: %', SQLERRM; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'calendar_events realtime: %', SQLERRM; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE habit_completions; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'habit_completions realtime: %', SQLERRM; END $$;

