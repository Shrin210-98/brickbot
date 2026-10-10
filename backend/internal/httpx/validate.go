package httpx

import (
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

var validate = newValidator()

func newValidator() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())
	// Report field errors by JSON name so they match what the client sent.
	v.RegisterTagNameFunc(func(f reflect.StructField) string {
		name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
		if name == "" || name == "-" {
			return f.Name
		}
		return name
	})
	return v
}

// Validate runs struct validation. On failure it writes a 422 with per-field
// messages and returns false.
func Validate(w http.ResponseWriter, s any) bool {
	err := validate.Struct(s)
	if err == nil {
		return true
	}
	var verrs validator.ValidationErrors
	if !errors.As(err, &verrs) {
		Error(w, http.StatusInternalServerError, CodeInternal, "Internal server error", nil)
		return false
	}
	fields := make(map[string]string, len(verrs))
	for _, fe := range verrs {
		fields[fe.Field()] = fieldMessage(fe)
	}
	Error(w, http.StatusUnprocessableEntity, CodeValidationFailed, "Request validation failed", fields)
	return false
}

func fieldMessage(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "is required"
	case "oneof":
		return "must be one of: " + strings.ReplaceAll(fe.Param(), " ", ", ")
	case "min":
		if fe.Kind() == reflect.String {
			return fmt.Sprintf("must be at least %s characters", fe.Param())
		}
		return "must be at least " + fe.Param()
	case "max":
		if fe.Kind() == reflect.String {
			return fmt.Sprintf("must be at most %s characters", fe.Param())
		}
		return "must be at most " + fe.Param()
	default:
		return "is invalid"
	}
}
