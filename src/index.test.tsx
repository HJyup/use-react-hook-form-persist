import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { useFormPersist } from './index';
import type { useFormPersistOptions } from './index';

function TestForm({
  storage,
  options,
}: {
  storage: Storage;
  options?: Partial<
    useFormPersistOptions<{ name?: string; email?: string; password?: string }>
  >;
}) {
  const form = useForm<{ name?: string; email?: string; password?: string }>({
    defaultValues: { name: '', email: '', password: '' },
    mode: 'onChange',
  });
  const persisted = useFormPersist(form, {
    key: 'test-form',
    storage,
    clearOnSubmit: true,
    ...(options),
  });

  const { register, handleSubmit, setValue, watch } = persisted;
  const values = watch();

  return (
    <form onSubmit={handleSubmit(() => {})}>
      <input aria-label="name" {...register('name')} />
      <input aria-label="email" {...register('email')} />
      <input aria-label="password" type="password" {...register('password')} />
      <button type="button" onClick={() => setValue('name', 'Alice')}>
        set-name
      </button>
      <button type="submit">submit</button>
      <pre aria-label="values">{JSON.stringify(values)}</pre>
    </form>
  );
}

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('useFormPersist', () => {
  test('persists and restores values', async () => {
    const storage = new MemoryStorage();
    const { unmount } = render(<TestForm storage={storage} />);

    await act(async () => {
      screen.getByRole('button', { name: 'set-name' }).click();
    });

    await waitFor(() => expect(storage.getItem('test-form')).not.toBeNull());

    unmount();
    render(<TestForm storage={storage} />);

    expect(screen.getByLabelText('values').textContent).toContain('Alice');
  });

  function NestedTestForm({
    storage,
    options,
  }: {
    storage: Storage;
    options?: Partial<
      useFormPersistOptions<{
        profile: { name: string; address: { city: string } };
      }>
    >;
  }) {
    const form = useForm<{
      profile: { name: string; address: { city: string } };
    }>({
      defaultValues: { profile: { name: '', address: { city: '' } } },
      mode: 'onChange',
    });
    const persisted = useFormPersist(form, {
      key: 'nested-form',
      storage,
      clearOnSubmit: true,
      ...(options),
    });

    const { register, handleSubmit, watch } = persisted;
    const values = watch();

    return (
      <form onSubmit={handleSubmit(() => {})}>
        <input aria-label="profile.name" {...register('profile.name')} />
        <input
          aria-label="profile.address.city"
          {...register('profile.address.city')}
        />
        <button type="submit">submit</button>
        <pre aria-label="values">{JSON.stringify(values)}</pre>
      </form>
    );
  }

  test('persists and restores nested values', async () => {
    const storage = new MemoryStorage();
    const { unmount } = render(<NestedTestForm storage={storage} />);

    const name = screen.getByLabelText('profile.name') as HTMLInputElement;
    const city = screen.getByLabelText('profile.address.city') as HTMLInputElement;
    await userEvent.type(name, 'Alice');
    await userEvent.type(city, 'Kyiv');

    await waitFor(() => expect(storage.getItem('nested-form')).not.toBeNull());

    unmount();
    render(<NestedTestForm storage={storage} />);

    expect(screen.getByLabelText('values').textContent).toContain('Alice');
    expect(screen.getByLabelText('values').textContent).toContain('Kyiv');
  });

  test('include only persists specific nested paths', async () => {
    const storage = new MemoryStorage();
    render(
      <NestedTestForm
        storage={storage}
        options={{ include: ['profile.address.city'] }}
      />,
    );

    const name = screen.getByLabelText('profile.name') as HTMLInputElement;
    const city = screen.getByLabelText('profile.address.city') as HTMLInputElement;
    await userEvent.type(name, 'Alice');
    await userEvent.type(city, 'Kyiv');

    const raw = await waitFor(() => storage.getItem('nested-form'));
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.data?.profile?.address?.city).toBe('Kyiv');
    expect(parsed.data?.profile?.name).toBeUndefined();
  });

  test('exclude prevents saving nested path', async () => {
    const storage = new MemoryStorage();
    render(
      <NestedTestForm
        storage={storage}
        options={{ exclude: ['profile.address.city'] }}
      />,
    );

    const name = screen.getByLabelText('profile.name') as HTMLInputElement;
    const city = screen.getByLabelText('profile.address.city') as HTMLInputElement;
    await userEvent.type(name, 'Alice');
    await userEvent.type(city, 'Kyiv');

    const raw = await waitFor(() => storage.getItem('nested-form'));
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.data?.profile?.name).toBe('Alice');
    expect(parsed.data?.profile?.address?.city).toBeUndefined();
  });

  test('skips unknown top-level fields on restore', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'nested-form',
      JSON.stringify({
        version: '1',
        data: {
          unknown: 'value',
          profile: { name: 'Bob', address: { city: 'Berlin' } },
        },
      }),
    );

    render(<NestedTestForm storage={storage} />);

    const valuesText = screen.getByLabelText('values').textContent ?? '';
    expect(valuesText).toContain('Bob');
    expect(valuesText).toContain('Berlin');
    expect(valuesText).not.toContain('unknown');
  });

  test('exclude prevents saving specified fields', async () => {
    const storage = new MemoryStorage();
    render(<TestForm storage={storage} options={{ exclude: ['password'] }} />);

    const password = screen.getByLabelText('password') as HTMLInputElement;
    await userEvent.type(password, 'secret');

    const raw = await waitFor(() => storage.getItem('test-form'));
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.data.password).toBeUndefined();
  });

  test('include only persists specific fields', async () => {
    const storage = new MemoryStorage();
    render(
      <TestForm storage={storage} options={{ include: ['name'] }} />,
    );

    const email = screen.getByLabelText('email') as HTMLInputElement;
    await userEvent.type(email, 'user@example.com');

    const raw = await waitFor(() => storage.getItem('test-form'));
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.data.email).toBeUndefined();
  });

  test('clears storage on submit when clearOnSubmit is true', async () => {
    const storage = new MemoryStorage();
    render(<TestForm storage={storage} />);

    await act(async () => {
      screen.getByRole('button', { name: 'set-name' }).click();
    });
    expect(storage.getItem('test-form')).not.toBeNull();

    await act(async () => {
      screen.getByRole('button', { name: 'submit' }).click();
    });
    expect(storage.getItem('test-form')).toBeNull();
  });

  test('version mismatch triggers callback and does not restore', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'test-form',
      JSON.stringify({ version: '2', data: { name: 'Bob' } }),
    );

    const onVersionMismatch = vi.fn();
    render(
      <TestForm
        storage={storage}
        options={{ version: '1', onVersionMismatch }}
      />,
    );

    expect(onVersionMismatch).toHaveBeenCalledWith('2', '1');
    expect(screen.getByLabelText('values').textContent).not.toContain('Bob');
  });
});


