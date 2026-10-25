"use client";

import { useRef } from "react";
import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

// React state updates on the next render. Lock synchronously as well so rapid
// clicks and repeated form submits cannot start overlapping mutations.
export function useExclusiveMutation<TData = unknown, TVariables = void>(options: UseMutationOptions<TData, Error, TVariables>) {
  const lock = useRef(false);
  const mutation = useMutation(options);
  const mutate = (variables: TVariables) => {
    if (lock.current) return;
    lock.current = true;
    void mutation.mutateAsync(variables).catch(() => {
      // The mutation exposes the error to the form. Keep the event handler safe.
    }).finally(() => { lock.current = false; });
  };
  return { ...mutation, mutate };
}
