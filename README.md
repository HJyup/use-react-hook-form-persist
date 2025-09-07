# use-react-hook-form-persist

A lightweight hook for persisting form state in `react-hook-form`, with support for nested fields, custom storage, and full control.

## 🚀 Usage

A small example how you can use this hook:

```javascript
import { useForm } from "react-hook-form";
import { useFormPersist } from "use-react-hook-form-persist";

type FormValues = {
  name: string,
  email: string,
  password: string
};

export function ProfileForm() {
  const form =
    useForm <
    FormValues >
    {
      defaultValues: {
        name: "John Doe",
        email: "john.doe@example.com",
        password: ""
      }
    };

  const persistedForm = useFormPersist(form, {
    key: "form-data",
    exclude: ["password"],
    include: ["name", "email"]
  });

  const { register, handleSubmit } = persistedForm;

  return (
    <form onSubmit={handleSubmit((values) => console.log(values))}>
      <input {...register("name")} placeholder="Name" />
      <input {...register("email")} placeholder="Email" />
      <input {...register("password")} type="password" placeholder="Password" />
      <button type="submit">Save</button>
    </form>
  );
}
```

## 📦 Installation

Using your preferred package manager:

```bash
    # with pnpm
    pnpm add use-react-hook-form-persist

    # or with npm
    npm install use-react-hook-form-persist

    # or with yarn
    yarn add use-react-hook-form-persist
```

## ✨ Features

- Full control over storage (localStorage, sessionStorage, or custom) and serialisation parser.
- Works seamlessly with deeply nested form values, arrays, and objects.
- Include or exclude specific fields and paths with fine-grained control.
- Handle schema changes gracefully with version numbers and optional mismatch callbacks.
- Powered by TypeScript and react-hook-form’s path types for strong guarantees.

## License

[MIT](https://choosealicense.com/licenses/mit/)
